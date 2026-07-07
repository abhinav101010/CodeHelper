import type { EditorAdapter } from '../../adapters/types';
import type { SnippetSettings } from '../../types/settings';
import type { ActiveSnippet, SnippetTrigger } from '../../types/snippet';
import { parseSnippet } from './parser';
import { resolveVariable } from './templates';
import { BUILTIN_SNIPPETS } from './builtins';

export class SnippetEngine {
  private adapter: EditorAdapter;
  private settings: SnippetSettings;
  private activeSnippet: ActiveSnippet | null = null;
  private disposables: Array<{ dispose(): void }> = [];

  constructor(adapter: EditorAdapter, settings: SnippetSettings) {
    this.adapter = adapter;
    this.settings = settings;
    this.registerKeybinding();
  }

  private registerKeybinding(): void {
    const disposable = this.adapter.onKeyDown((e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // CRITICAL: if the Monaco (or Ace/CM) suggestion widget is open,
        // Tab should accept the suggestion — never let our snippet engine
        // swallow that keystroke.
        if (this.isAutocompleteVisible()) {
          return true; // pass through to editor's native Tab handler
        }
        return this.handleTab();
      }
      return true;
    });

    this.disposables.push(disposable);
  }

  private isAutocompleteVisible(): boolean {
    // Monaco suggestion / intellisense widget
    const monacoWidget = document.querySelector('.suggest-widget, .editor-widget.suggest-widget');
    if (monacoWidget) {
      // The widget exists in the DOM even when hidden; check visibility via class or display
      const el = monacoWidget as HTMLElement;
      if (el.offsetHeight > 0 && !el.classList.contains('hidden')) return true;
    }

    // Also check for the parameter hints widget (shown after '(')
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

    const allSnippets = [...BUILTIN_SNIPPETS, ...this.settings.customSnippets];

    // Match longest trigger first
    let bestMatch: SnippetTrigger | null = null;
    let bestLength = 0;

    for (const snippet of allSnippets) {
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
    const insertPos = { line: cursor.line, column: cursor.column - triggerLength };
    this.adapter.replaceRange({ start: insertPos, end: insertPos }, resolved.text);

    // Set up tabstop navigation
    if (resolved.tabstops.length > 0) {
      this.activeSnippet = {
        tabstops: resolved.tabstops,
        currentIndex: 0,
      };

      // Position cursor at first tabstop
      const firstTabstop = resolved.tabstops[0];
      this.adapter.setCursorPosition({
        line: insertPos.line + firstTabstop.line,
        column: insertPos.column + firstTabstop.column,
      });
    }
  }

  private resolveSegments(
    segments: Array<{ type: string; value?: string; index?: number; children?: any[] }>,
  ): { text: string; tabstops: Array<{ line: number; column: number; length: number }> } {
    let text = '';
    const tabstops: Array<{ line: number; column: number; length: number }> = [];
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
  }
}
