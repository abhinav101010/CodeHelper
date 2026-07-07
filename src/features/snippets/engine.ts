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
 * 1. **Monaco CompletionItemProvider** – When the editor is Monaco, snippets are
 *    registered as completion items so they appear in the autocomplete dropdown
 *    natively.  Monaco handles filtering, selection, and snippet-string insertion
 *    (including tabstops / placeholders) without any raw keydown interception.
 *
 * 2. **Tab-key fallback (Ace / CodeMirror)** – For editors that lack a completion
 *    provider API, the engine falls back to a lightweight `Tab` keydown detector
 *    that expands snippets manually (parser + replace).
 *
 * This avoids the common pitfalls of raw keydown listeners: no conflicts with
 * Monaco's built-in suggestion widget, no crashes on `undefined` event keys,
 * no swallowed Tab presses when the autocomplete is open.
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

    // For Monaco, register a completion-item provider — much more reliable
    // than sniffing keydown events.
    if (adapter.editorType === 'monaco') {
      this.registerMonacoCompletionProvider();
    } else {
      // Fallback for Ace / CodeMirror that don't have a completion-provider API
      // exposed through our adapter layer.
      this.registerKeybinding();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MONACO NATIVE PROVIDER
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Register a Monaco CompletionItemProvider that surfaces every snippet as a
   * completion item.  When the user picks one, Monaco inserts the snippet body
   * (with tabstop / placeholder markers) natively — no Tab interception needed.
   */
  private registerMonacoCompletionProvider(): void {
    const monaco = (window as any).monaco;
    if (!monaco?.languages) {
      console.warn('[CodeHelper] Monaco API not available for snippet provider');
      // Fall back to keydown-based approach
      this.registerKeybinding();
      return;
    }

    const allSnippets = this.getAllSnippets();

    // Register the provider for every language Monaco knows about.
    // This is broader than necessary, but Monaco's built-in filtering is fast.
    const languages = monaco.languages.getLanguages();
    const languageIds = languages.length ? languages.map((l: any) => l.id) : ['*'];

    // Filter out any null/undefined language IDs to prevent Monaco crashes
    const validLanguageIds = languageIds.filter((id: any) => id != null);

    const disposable = monaco.languages.registerCompletionItemProvider(validLanguageIds, {
      triggerCharacters: ['.', ' ', '\t'],
      provideCompletionItems: (model: any, position: any, _context: any, _token: any) => {
        try {
          // Only provide snippets if the editor on this model is ours
          const textUntilPos = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          // Find matching snippets
          const wordMatch = textUntilPos.match(/(\S+)$/);
          const currentWord = wordMatch ? wordMatch[1] : '';
          if (!currentWord) {
            return { suggestions: [] };
          }

          // Determine the language of this model — guard against missing languageId
          const modelLang = model.getLanguageId?.() ?? '';
          const snippets = this.getSnippetsForLanguage(modelLang, allSnippets);

          const suggestions: any[] = [];
          for (const snippet of snippets) {
            // Guard against malformed snippets (missing prefix array)
            if (!snippet.prefix || !Array.isArray(snippet.prefix)) continue;
            for (const prefix of snippet.prefix) {
              if (prefix.startsWith(currentWord) || currentWord.startsWith(prefix)) {
                // Monaco's CompletionItem with snippet string.
                // IMPORTANT: Use a PLAIN string for insertText, NOT { value } ISnippetString.
                // LeetCode's Monaco 0.55.3 passes the insertText directly to
                // SnippetParser.parse() which expects a plain string. The { value }
                // wrapper causes "this.value.charCodeAt is not a function".
                suggestions.push({
                  label: prefix,
                  detail: snippet.description,
                  insertText: snippet.body,
                  kind: monaco.languages.CompletionItemKind.Snippet,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column - currentWord.length,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                });
                break; // one suggestion per snippet
              }
            }
          }

          return { suggestions };
        } catch (err) {
          console.warn('[CodeHelper] Snippet provider threw:', err);
          return { suggestions: [] };
        }
      },
    });

    this.monacoDisposable = { dispose: () => disposable?.dispose?.() ?? disposable?.() };
    console.log('[CodeHelper] Monaco snippet provider registered');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KEYDOWN FALLBACK (Ace / CodeMirror)
  // ═══════════════════════════════════════════════════════════════════

  private registerKeybinding(): void {
    const disposable = this.adapter.onKeyDown((e: KeyboardEvent) => {
      // ── Critical guard ──────────────────────────────────────────────
      // e.key CAN be undefined for Monaco IKeyboardEvent events (modifier
      // keys, arrows, etc.).  Also skip non-Tab keys early.
      if (!e?.key || e.key !== 'Tab') return true;

      // If Monaco (or Ace/CM) suggestion widget is visible, Tab should
      // accept the highlighted suggestion — never swallow it.
      if (this.isAutocompleteVisible()) {
        return true;
      }

      return this.handleTab();
    });

    this.disposables.push(disposable);
    console.log('[CodeHelper] Snippet keybinding registered (fallback)');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private getAllSnippets(): Snippet[] {
    return [...BUILTIN_SNIPPETS, ...this.settings.customSnippets];
  }

  private getSnippetsForLanguage(lang: string, all: Snippet[]): Snippet[] {
    if (!lang) return all;
    const langLower = lang.toLowerCase();
    return all.filter((s) => {
      if (!s.language || s.language.length === 0) return true; // universal
      // Guard against null/undefined entries in the language array
      return s.language.some((l) => (l || '').toLowerCase() === langLower);
    });
  }

  private isAutocompleteVisible(): boolean {
    // Monaco suggestion / intellisense widget
    const monacoWidget = document.querySelector('.suggest-widget, .editor-widget.suggest-widget');
    if (monacoWidget) {
      const el = monacoWidget as HTMLElement;
      if (el.offsetHeight > 0 && !el.classList.contains('hidden')) return true;
    }

    // Parameter hints widget (shown after '(')
    const paramWidget = document.querySelector('.parameter-hints-widget');
    if (paramWidget && (paramWidget as HTMLElement).offsetHeight > 0) return true;

    // Ace autocomplete popup
    const acePopup = document.querySelector('.ace_autocomplete');
    if (acePopup && (acePopup as HTMLElement).offsetHeight > 0) return true;

    // CodeMirror 6 autocomplete tooltip
    const cmTooltip = document.querySelector('.cm-tooltip-autocomplete');
    if (cmTooltip) return true;

    return false;
  }

  private handleTab(): boolean {
    if (this.activeSnippet) {
      return this.advanceTabstop();
    }

    const trigger = this.findTriggerWord();
    if (trigger) {
      this.expandSnippet(trigger);
      return false; // consumed
    }

    // No snippet matched — let the editor's native Tab handler run
    // (for Monaco this means indent; for Ace/CM the IndentationEngine handles it)
    return true;
  }

  findTriggerWord(): SnippetTrigger | null {
    const cursor = this.adapter.getCursorPosition();
    const line = this.adapter.getLine(cursor.line);
    const textBeforeCursor = line.substring(0, cursor.column);

    const allSnippets = this.getAllSnippets();

    // Match longest trigger first
    let bestMatch: SnippetTrigger | null = null;
    let bestLength = 0;

    for (const snippet of allSnippets) {
      // Guard against malformed snippets (missing prefix array)
      if (!snippet.prefix || !Array.isArray(snippet.prefix)) continue;
      for (const prefix of snippet.prefix) {
        if (textBeforeCursor.endsWith(prefix) && prefix.length > bestLength) {
          // Check word boundary — don't trigger in the middle of a word
          const charBefore = textBeforeCursor[textBeforeCursor.length - prefix.length - 1];
          if (!charBefore || /\W/.test(charBefore)) {
            bestMatch = { snippet, triggerLength: prefix.length };
            bestLength = prefix.length;
          }
        }
      }
    }

    return bestMatch;
  }

  private expandSnippet(trigger: SnippetTrigger): void {
    const { snippet, triggerLength } = trigger;
    const cursor = this.adapter.getCursorPosition();

    // Delete the trigger text
    const start = { line: cursor.line, column: cursor.column - triggerLength };
    this.adapter.replaceRange({ start, end: cursor }, '');

    // Parse snippet body
    const parsed = parseSnippet(snippet.body);
    const resolved = this.resolveSegments(parsed.segments);

    // Insert resolved snippet
    const insertPos = {
      line: cursor.line,
      column: cursor.column - triggerLength,
    };
    this.adapter.replaceRange({ start: insertPos, end: insertPos }, resolved.text);

    // Set up tabstop navigation (fallback only — Monaco handles this natively)
    if (resolved.tabstops.length > 0) {
      this.activeSnippet = {
        tabstops: resolved.tabstops,
        currentIndex: 0,
      };

      const firstTabstop = resolved.tabstops[0];
      this.adapter.setCursorPosition({
        line: insertPos.line + firstTabstop.line,
        column: insertPos.column + firstTabstop.column,
      });
    }
  }

  private resolveSegments(
    segments: Array<{
      type: string;
      value?: string;
      index?: number;
      children?: any[];
    }>,
  ): {
    text: string;
    tabstops: Array<{ line: number; column: number; length: number }>;
  } {
    let text = '';
    const tabstops: Array<{
      line: number;
      column: number;
      length: number;
    }> = [];
    let currentLine = 0;
    let currentColumn = 0;

    for (const segment of segments) {
      if (segment.type === 'text') {
        const value = segment.value || '';
        text += value;
        currentColumn += value.length;
      } else if (segment.type === 'tabstop') {
        const index = segment.index ?? 0;
        const placeholder = segment.children?.[0]?.value || '';

        tabstops[index] = {
          line: currentLine,
          column: currentColumn,
          length: placeholder.length,
        };

        text += placeholder;
        currentColumn += placeholder.length;
      } else if (segment.type === 'variable') {
        const resolved = resolveVariable(segment.value || '');
        text += resolved;
        currentColumn += resolved.length;
      }
    }

    return { text, tabstops };
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
      return false; // consumed
    }

    // No more tabstops — exit snippet mode and let Tab through
    this.activeSnippet = null;
    return true;
  }

  updateSettings(settings: SnippetSettings): void {
    this.settings = settings;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.monacoDisposable?.dispose();
    this.monacoDisposable = null;
    this.activeSnippet = null;
  }
}
