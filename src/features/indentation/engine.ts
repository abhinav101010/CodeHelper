import type { EditorAdapter } from '../../adapters/types';
import type { IndentationSettings } from '../../types/settings';

export class IndentationEngine {
  private adapter: EditorAdapter;
  private settings: IndentationSettings;
  private disposables: Array<{ dispose(): void }> = [];

  constructor(adapter: EditorAdapter, settings: IndentationSettings) {
    this.adapter = adapter;
    this.settings = settings;
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // For Monaco editors, skip ALL key interception entirely.
    // Monaco handles Tab (accept suggestion / indent), Enter (accept suggestion /
    // newline + auto-indent), and Backspace natively and correctly.
    // Overriding those keys breaks the suggestion widget.
    if (this.adapter.editorType === 'monaco') {
      console.log('[CodeHelper] IndentationEngine: skipping key hooks for Monaco (native handling)');
      return;
    }

    const enterDisposable = this.adapter.onKeyDown((e: KeyboardEvent) => {
      // Never intercept when an autocomplete/suggestion widget is open —
      // Tab and Enter must reach the widget so the user can accept a suggestion.
      if (this.isAutocompleteVisible()) {
        return true; // pass through
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        return this.handleEnter();
      }
      if (e.key === 'Backspace' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        return this.handleBackspace();
      }
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        return this.handleTab();
      }
      if (e.key === 'Tab' && e.shiftKey) {
        return this.handleShiftTab();
      }
      return true;
    });

    this.disposables.push(enterDisposable);
  }

  private isAutocompleteVisible(): boolean {
    // Monaco suggestion widget
    const monacoWidget = document.querySelector('.suggest-widget, .editor-widget.suggest-widget');
    if (monacoWidget) return true;

    // Ace autocomplete
    const acePopup = document.querySelector('.ace_autocomplete');
    if (acePopup && (acePopup as HTMLElement).offsetHeight > 0) return true;

    // CodeMirror 6 autocomplete tooltip
    const cmTooltip = document.querySelector('.cm-tooltip-autocomplete');
    if (cmTooltip) return true;

    return false;
  }

  private handleEnter(): boolean {
    const cursor = this.adapter.getCursorPosition();
    const line = this.adapter.getLine(cursor.line);
    const trimmed = line.trimEnd();
    const lastChar = trimmed[trimmed.length - 1];

    // After { [ ( → increase indent
    if ('{[('.includes(lastChar)) {
      const currentIndent = this.getIndentLevel(line);
      const indentStr = this.getIndentString();
      const insertion = '\n' + indentStr.repeat(currentIndent + 1);
      this.adapter.replaceRange({ start: cursor, end: cursor }, insertion);
      return false;
    }

    // After } ] ) → decrease indent
    if ('}])'.includes(lastChar)) {
      if (trimmed === lastChar || trimmed === lastChar + ';') {
        const currentIndent = this.getIndentLevel(line);
        const indentStr = this.getIndentString();
        const insertion = '\n' + indentStr.repeat(Math.max(0, currentIndent - 1));
        this.adapter.replaceRange({ start: cursor, end: cursor }, insertion);
        return false;
      }
    }

    // After : (Python) → increase indent
    if (lastChar === ':') {
      const currentIndent = this.getIndentLevel(line);
      const indentStr = this.getIndentString();
      const insertion = '\n' + indentStr.repeat(currentIndent + 1);
      this.adapter.replaceRange({ start: cursor, end: cursor }, insertion);
      return false;
    }

    // Default: match current line's indent
    const currentIndent = this.getIndentLevel(line);
    const indentStr = this.getIndentString();
    const insertion = '\n' + indentStr.repeat(currentIndent);
    this.adapter.replaceRange({ start: cursor, end: cursor }, insertion);
    return false;
  }

  private handleBackspace(): boolean {
    const cursor = this.adapter.getCursorPosition();
    if (cursor.column === 0) return true;

    const line = this.adapter.getLine(cursor.line);
    const beforeCursor = line.substring(0, cursor.column);

    // If cursor is after whitespace only → smart dedent
    if (/^\s+$/.test(beforeCursor)) {
      const indentSize = this.getIndentSize();
      const currentSpaces = beforeCursor.length;
      const targetSpaces = Math.floor((currentSpaces - 1) / indentSize) * indentSize;
      const deleteCount = currentSpaces - targetSpaces;

      this.adapter.replaceRange(
        {
          start: { line: cursor.line, column: cursor.column - deleteCount },
          end: cursor,
        },
        '',
      );
      return false;
    }

    return true; // Let native backspace handle it
  }

  private handleTab(): boolean {
    const cursor = this.adapter.getCursorPosition();
    const indentStr = this.getIndentString();
    this.adapter.replaceRange({ start: cursor, end: cursor }, indentStr);
    return false;
  }

  private handleShiftTab(): boolean {
    const cursor = this.adapter.getCursorPosition();
    const line = this.adapter.getLine(cursor.line);
    const beforeCursor = line.substring(0, cursor.column);

    if (beforeCursor.length === 0) return true;

    const indentSize = this.getIndentSize();
    const currentSpaces = beforeCursor.length;
    const targetSpaces = Math.max(0, Math.floor((currentSpaces - 1) / indentSize) * indentSize);
    const deleteCount = currentSpaces - targetSpaces;

    if (deleteCount > 0) {
      this.adapter.replaceRange(
        {
          start: { line: cursor.line, column: cursor.column - deleteCount },
          end: cursor,
        },
        '',
      );
      return false;
    }

    return true;
  }

  private getIndentLevel(line: string): number {
    const indent = line.match(/^\s*/)?.[0] ?? '';
    const indentSize = this.getIndentSize();
    return Math.floor(indent.length / indentSize);
  }

  private getIndentString(): string {
    return ' '.repeat(this.getIndentSize());
  }

  private getIndentSize(): number {
    return 4;
  }

  updateSettings(settings: IndentationSettings): void {
    this.settings = settings;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
