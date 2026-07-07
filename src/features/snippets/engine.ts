import type { EditorAdapter } from '../../adapters/types';
import type { SnippetSettings } from '../../types/settings';
import type { ActiveSnippet, Snippet, SnippetTrigger } from '../../types/snippet';
import { parseSnippet } from './parser';
import { resolveVariable } from './templates';
import { BUILTIN_SNIPPETS } from './builtins';

/**
 * SnippetEngine
 *
 * Provides snippet expansion via two complementary strategies:
 *
 * 1. **Monaco CompletionItemProvider** (full body) – Shows snippets in the
 *    autocomplete dropdown.  When selected, Monaco inserts the full expanded
 *    snippet body as plain text (kind:Text avoids Monaco 0.55.3's broken
 *    snippet pipeline).  An onDidCompleteCompletion listener repositions
 *    the cursor to the first tabstop after insertion.
 *
 * 2. **Tab-key fallback** – For all editors (including Monaco when the
 *    suggestion widget is not visible).  Detects Tab press, finds a matching
 *    snippet trigger at the cursor, and expands it via our own parser.
 */
export class SnippetEngine {
  private adapter: EditorAdapter;
  private settings: SnippetSettings;
  private activeSnippet: ActiveSnippet | null = null;
  private disposables: Array<{ dispose(): void }> = [];
  private monacoDisposable: { dispose(): void } | null = null;

  constructor(adapter: EditorAdapter, settings: SnippetSettings) {
    this.adapter = adapter;
    this.settings = settings;

    if (adapter.editorType === 'monaco') {
      this.registerMonacoCompletionProvider();
    }

    this.registerKeybinding();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MONACO PROVIDER (Full-body snippet insertion)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Register a Monaco CompletionItemProvider that surfaces snippets as
   * plain-text suggestions with the FULL expanded snippet body as
   * insertText (kind:Text avoids Monaco 0.55.3's broken snippet pipeline).
   *
   * Also registers an onDidCompleteCompletion listener that repositions
   * the cursor to the first tabstop after the body is inserted.
   */
  private registerMonacoCompletionProvider(): void {
    const monaco = (window as any).monaco;
    if (!monaco?.languages) {
      console.warn('[CodeHelper] Monaco API not available for snippet provider');
      return;
    }

    const allSnippets = this.getAllSnippets();
    if (!Array.isArray(allSnippets) || allSnippets.length === 0) {
      console.log('[CodeHelper] No snippets to register');
      return;
    }

    // Build language list
    let validLanguageIds: string[];
    try {
      const languages = monaco.languages.getLanguages();
      validLanguageIds =
        Array.isArray(languages) && languages.length
          ? languages
              .map((l: any) => l?.id)
              .filter((id: any) => id != null && typeof id === 'string')
          : ['*'];
    } catch {
      validLanguageIds = ['*'];
    }
    if (validLanguageIds.length === 0) validLanguageIds = ['*'];

    // Pre-index snippets by language for fast lookup
    const snippetsByLang = this.buildSnippetsIndex(allSnippets);

    // Map from label to resolved snippet info (used for tabstop positioning)
    // Keep as weak reference if possible, but a plain Map is fine since the
    // provider has the same lifetime as the engine.
    const snippetInfoMap = new Map<
      string,
      {
        resolved: {
          text: string;
          tabstops: Array<{ line: number; column: number; length: number }>;
        };
      }
    >();

    let disposable: { dispose(): void } | null = null;
    try {
      disposable = monaco.languages.registerCompletionItemProvider(validLanguageIds, {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: (model: any, position: any, _context: any, _token: any) => {
          try {
            if (!model || !position) return { suggestions: [] };

            // Get text before cursor
            let textUntilPos = '';
            try {
              textUntilPos = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              });
            } catch {
              return { suggestions: [] };
            }
            if (!textUntilPos || typeof textUntilPos !== 'string') return { suggestions: [] };

            // Find current word
            const wordMatch = textUntilPos.match(/(\S+)$/);
            const currentWord = wordMatch ? wordMatch[1] : '';
            if (!currentWord || currentWord.length === 0) return { suggestions: [] };

            const modelLang =
              (typeof model.getLanguageId === 'function' ? model.getLanguageId() : '') || '';
            const snippets = this.getCachedSnippetsForLanguage(modelLang, snippetsByLang);
            if (!Array.isArray(snippets) || snippets.length === 0) return { suggestions: [] };

            const suggestions: any[] = [];
            for (const snippet of snippets) {
              if (!snippet || typeof snippet !== 'object') continue;
              if (!Array.isArray(snippet.prefix) || snippet.prefix.length === 0) continue;
              if (!snippet.body || typeof snippet.body !== 'string') continue;

              for (const prefix of snippet.prefix) {
                if (!prefix || typeof prefix !== 'string') continue;
                if (prefix.startsWith(currentWord) || currentWord.startsWith(prefix)) {
                  // Parse and resolve the snippet body to get the text with
                  // tabstop placeholders resolved.
                  const parsed = parseSnippet(snippet.body);
                  let resolved: {
                    text: string;
                    tabstops: Array<{ line: number; column: number; length: number }>;
                  } | null = null;
                  if (parsed && Array.isArray(parsed.segments)) {
                    resolved = this.resolveSegments(parsed.segments);
                  }

                  if (resolved && resolved.text) {
                    // Store the resolved info for cursor positioning later
                    snippetInfoMap.set(prefix, { resolved });

                    // Use the FULL expanded body as insertText.
                    // kind:Text avoids Monaco's snippet processing entirely.
                    // Monaco inserts this as plain text — no snippet parsing,
                    // no ISnippetString wrapping, no InsertAsSnippet.
                    suggestions.push({
                      label: prefix,
                      detail: snippet.description || '',
                      insertText: resolved.text,
                      kind: monaco.languages.CompletionItemKind.Text,
                      range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column - currentWord.length,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column,
                      },
                    });
                  }
                  break;
                }
              }
            }

            if (suggestions.length > 0) {
              console.log(
                '[CodeHelper] Snippet provider: returning',
                suggestions.length,
                'suggestions for',
                currentWord,
              );
            }

            return { suggestions };
          } catch (err) {
            console.warn('[CodeHelper] Snippet provider threw:', err);
            return { suggestions: [] };
          }
        },
      });

      // Listen for completion acceptance on ALL Monaco editors to reposition
      // cursor to the first tabstop after a snippet body is inserted.
      this.registerCompletionListener(monaco, snippetInfoMap);

      this.monacoDisposable = {
        dispose: () => {
          try {
            if (typeof disposable?.dispose === 'function') disposable.dispose();
          } catch {
            /* ignore */
          }
        },
      };
      console.log(
        '[CodeHelper] Monaco snippet provider registered with',
        allSnippets.length,
        'snippets',
      );
    } catch (err) {
      console.warn('[CodeHelper] Failed to register Monaco snippet provider:', err);
    }
  }

  /**
   * Register an onDidCompleteCompletion listener that repositions the cursor
   * to the first tabstop after a snippet body is inserted via autocomplete.
   */
  private registerCompletionListener(
    monaco: any,
    snippetInfoMap: Map<
      string,
      {
        resolved: {
          text: string;
          tabstops: Array<{ line: number; column: number; length: number }>;
        };
      }
    >,
  ): void {
    try {
      const editors = monaco.editor?.getEditors?.();
      if (!Array.isArray(editors)) return;

      for (const editor of editors) {
        if (typeof editor.onDidCompleteCompletion !== 'function') continue;

        try {
          editor.onDidCompleteCompletion((event: any) => {
            try {
              const completion = event?.completion;
              if (!completion) return;

              // Get the label from the completion item
              const label =
                typeof completion.label === 'string' ? completion.label : completion.label?.label;
              if (!label || typeof label !== 'string') return;

              // Check if this completion is one of our snippets
              const info = snippetInfoMap.get(label);
              if (!info) return;

              // Position cursor at the first tabstop
              if (Array.isArray(info.resolved.tabstops) && info.resolved.tabstops.length > 0) {
                const first = info.resolved.tabstops[0];
                const range = completion.range;

                // Calculate absolute tabstop position using the insertion range
                const startLine = range?.startLineNumber ?? 1;
                const startCol = range?.startColumn ?? 1;

                const lineNumber = startLine + first.line;
                const column = first.line === 0 ? startCol + first.column : 1 + first.column;

                editor.setPosition({ lineNumber, column });

                // Store for subsequent Tab navigation
                this.activeSnippet = {
                  tabstops: info.resolved.tabstops,
                  currentIndex: 0,
                };
              }
            } catch (err) {
              // Silently ignore — this is a best-effort cursor adjustment
            }
          });
        } catch {
          // Editor may reject listener registration
        }
      }
    } catch {
      // Silently ignore if event doesn't exist in this Monaco version
    }
  }

  /**
   * Build a pre-indexed map of snippets by language.
   */
  private buildSnippetsIndex(allSnippets: Snippet[]): Record<string, Snippet[]> {
    const index: Record<string, Snippet[]> = { _universal: [] };
    for (const snippet of allSnippets) {
      if (!snippet || typeof snippet !== 'object') continue;
      if (!Array.isArray(snippet.language) || snippet.language.length === 0) {
        index._universal.push(snippet);
      } else {
        for (const lang of snippet.language) {
          if (!lang || typeof lang !== 'string') continue;
          const key = lang.toLowerCase();
          if (!index[key]) index[key] = [];
          index[key].push(snippet);
        }
      }
    }
    return index;
  }

  /**
   * Get snippets for a given language from the pre-built index.
   */
  private getCachedSnippetsForLanguage(lang: string, index: Record<string, Snippet[]>): Snippet[] {
    const key = (lang || '').toLowerCase();
    const langSnippets = index[key] || [];
    const universal = index._universal || [];
    if (langSnippets.length === 0) return universal;
    return [...langSnippets, ...universal];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KEYDOWN TAB HANDLER
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Register a keydown handler for Tab key that expands snippets.
   *
   * Important: the snippet trigger check runs BEFORE the autocomplete
   * visibility check.  This means pressing Tab while the suggestion widget
   * is visible will expand a matching snippet rather than accepting the
   * selected suggestion (which would just insert the plain prefix).
   */
  private registerKeybinding(): void {
    const disposable = this.adapter.onKeyDown((e: KeyboardEvent) => {
      try {
        if (!e?.key || e.key !== 'Tab') return true;

        // If we have an active snippet, advance to next tabstop
        if (this.activeSnippet) {
          return this.advanceTabstop();
        }

        // Check for a snippet trigger at the cursor position.
        // This runs BEFORE the autocomplete visibility check so that
        // Tab always expands a snippet when a trigger word is present,
        // even when Monaco's suggestion widget is visible.
        const trigger = this.findTriggerWord();
        if (trigger) {
          this.expandSnippet(trigger);
          return false;
        }

        // If Monaco's autocomplete widget is visible, let Monaco handle
        // Tab normally (accepts the selected suggestion).
        if (this.isAutocompleteVisible()) {
          return true;
        }
      } catch (err) {
        console.warn('[CodeHelper] Snippet keybinding threw:', err);
      }
      return true;
    });

    this.disposables.push(disposable);
    console.log('[CodeHelper] Snippet keybinding registered');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private getAllSnippets(): Snippet[] {
    const builtins = Array.isArray(BUILTIN_SNIPPETS) ? BUILTIN_SNIPPETS : [];
    const custom = Array.isArray(this.settings.customSnippets) ? this.settings.customSnippets : [];
    return [...builtins, ...custom];
  }

  private isAutocompleteVisible(): boolean {
    try {
      const monacoWidget = document.querySelector('.suggest-widget, .editor-widget.suggest-widget');
      if (monacoWidget) {
        const el = monacoWidget as HTMLElement;
        if (el.offsetHeight > 0 && !el.classList.contains('hidden')) return true;
      }
      const paramWidget = document.querySelector('.parameter-hints-widget');
      if (paramWidget && (paramWidget as HTMLElement).offsetHeight > 0) return true;
      const acePopup = document.querySelector('.ace_autocomplete');
      if (acePopup && (acePopup as HTMLElement).offsetHeight > 0) return true;
      const cmTooltip = document.querySelector('.cm-tooltip-autocomplete');
      if (cmTooltip) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  findTriggerWord(): SnippetTrigger | null {
    try {
      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return null;
      const line = this.adapter.getLine(cursor.line);
      if (typeof line !== 'string') return null;
      const textBeforeCursor = line.substring(0, cursor.column);
      if (!textBeforeCursor) return null;

      const allSnippets = this.getAllSnippets();
      if (!Array.isArray(allSnippets) || allSnippets.length === 0) return null;

      let bestMatch: SnippetTrigger | null = null;
      let bestLength = 0;

      for (const snippet of allSnippets) {
        if (!snippet || typeof snippet !== 'object') continue;
        if (!Array.isArray(snippet.prefix) || snippet.prefix.length === 0) continue;
        if (!snippet.body || typeof snippet.body !== 'string') continue;

        for (const prefix of snippet.prefix) {
          if (!prefix || typeof prefix !== 'string') continue;
          if (prefix.length === 0) continue;

          // Check if text ends with the prefix (word boundary)
          const charBefore = textBeforeCursor[textBeforeCursor.length - prefix.length - 1];
          const triggerLength = prefix.length;

          // Only match at word boundary (previous char is space/newline/start)
          const isWordBoundary =
            triggerLength >= textBeforeCursor.length ||
            !charBefore ||
            /[\s\n\r()\[\]{}"'`.,;:!?+-/*%]/.test(charBefore);

          if (isWordBoundary && textBeforeCursor.endsWith(prefix) && triggerLength > bestLength) {
            bestMatch = { snippet, triggerLength };
            bestLength = triggerLength;
          }
        }
      }

      return bestMatch;
    } catch (err) {
      console.warn('[CodeHelper] findTriggerWord threw:', err);
      return null;
    }
  }

  private expandSnippet(trigger: SnippetTrigger): void {
    try {
      const { snippet, triggerLength } = trigger;
      if (!snippet || typeof triggerLength !== 'number') return;
      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return;

      const start = { line: cursor.line, column: cursor.column - triggerLength };
      this.adapter.replaceRange({ start, end: cursor }, '');

      if (!snippet.body || typeof snippet.body !== 'string') return;
      const parsed = parseSnippet(snippet.body);
      if (!parsed || !Array.isArray(parsed.segments)) return;

      const resolved = this.resolveSegments(parsed.segments);
      if (!resolved) return;

      const insertPos = { line: cursor.line, column: cursor.column - triggerLength };
      this.adapter.replaceRange({ start: insertPos, end: insertPos }, resolved.text);

      if (Array.isArray(resolved.tabstops) && resolved.tabstops.length > 0) {
        this.activeSnippet = {
          tabstops: resolved.tabstops,
          currentIndex: 0,
        };
        const firstTabstop = resolved.tabstops[0];
        if (firstTabstop) {
          this.adapter.setCursorPosition({
            line: insertPos.line + firstTabstop.line,
            column: insertPos.column + firstTabstop.column,
          });
        }
      }
    } catch (err) {
      console.warn('[CodeHelper] expandSnippet threw:', err);
    }
  }

  private resolveSegments(
    segments: Array<{
      type: string;
      value?: string;
      index?: number;
      children?: any[];
    }>,
  ): { text: string; tabstops: Array<{ line: number; column: number; length: number }> } | null {
    try {
      if (!Array.isArray(segments)) return null;
      let text = '';
      const tabstops: Array<{ line: number; column: number; length: number }> = [];
      let currentLine = 0;
      let currentColumn = 0;

      for (const segment of segments) {
        if (!segment || typeof segment !== 'object') continue;
        if (segment.type === 'text') {
          const value = typeof segment.value === 'string' ? segment.value : '';
          text += value;
          currentColumn += value.length;
        } else if (segment.type === 'tabstop') {
          const index = typeof segment.index === 'number' ? segment.index : 0;
          const placeholder = segment.children?.[0]?.value || '';
          tabstops[index] = {
            line: currentLine,
            column: currentColumn,
            length: placeholder.length,
          };
          text += placeholder;
          currentColumn += placeholder.length;
        } else if (segment.type === 'variable') {
          const resolved = resolveVariable(typeof segment.value === 'string' ? segment.value : '');
          text += resolved;
          currentColumn += resolved.length;
        }
      }
      return { text, tabstops };
    } catch (err) {
      console.warn('[CodeHelper] resolveSegments threw:', err);
      return { text: '', tabstops: [] };
    }
  }

  private advanceTabstop(): boolean {
    if (!this.activeSnippet) return true;
    const nextIndex = this.activeSnippet.currentIndex + 1;
    const nextTabstop = this.activeSnippet.tabstops[nextIndex];
    if (nextTabstop) {
      this.activeSnippet.currentIndex = nextIndex;
      this.adapter.setCursorPosition({
        line: nextTabstop.line,
        column: nextTabstop.column,
      });
      return false;
    }
    this.activeSnippet = null;
    return true;
  }

  updateSettings(settings: SnippetSettings): void {
    this.settings = settings;
  }

  dispose(): void {
    this.disposables.forEach((d) => {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    });
    this.disposables = [];
    if (this.monacoDisposable) {
      try {
        this.monacoDisposable.dispose();
      } catch {
        /* ignore */
      }
      this.monacoDisposable = null;
    }
    this.activeSnippet = null;
  }
}
