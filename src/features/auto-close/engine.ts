import type { EditorAdapter } from '../../adapters/types';
import type { AutoCloseSettings } from '../../types/settings';

export class AutoCloseEngine {
  private adapter: EditorAdapter;
  private settings: AutoCloseSettings;
  private disposables: Array<{ dispose(): void }> = [];

  constructor(adapter: EditorAdapter, settings: AutoCloseSettings) {
    this.adapter = adapter;
    this.settings = settings;
    this.registerHandler();
  }

  private registerHandler(): void {
    const disposable = this.adapter.onDidChangeContent(() => {
      this.handleChange();
    });

    this.disposables.push(disposable);
  }

  private handleChange(): void {
    const cursor = this.adapter.getCursorPosition();
    const line = this.adapter.getLine(cursor.line);

    // Get the character just typed (at cursor position)
    const charBefore = line[cursor.column - 2];
    const charAtCursor = line[cursor.column - 1];

    // Check if this is an opening pair character
    if (charBefore && this.settings.pairs[charBefore]) {
      const closing = this.settings.pairs[charBefore];

      // Don't auto-close if:
      // 1. Next char is alphanumeric (e.g., typing ` in a word)
      if (charAtCursor && /\w/.test(charAtCursor)) return;

      // 2. We're inside a string context (basic heuristic)
      if (this.isInsideString(cursor)) return;

      // Insert the closing character after cursor
      this.adapter.replaceRange({ start: cursor, end: cursor }, closing);

      // Move cursor back one position (between the pair)
      this.adapter.setCursorPosition(cursor);
    }
  }

  private isInsideString(_cursor: { line: number; column: number }): boolean {
    // Basic heuristic: check if we're inside a string
    // This is a simplified check - a full implementation would need proper parsing
    const line = this.adapter.getLine(_cursor.line);
    const beforeCursor = line.substring(0, _cursor.column);

    // Count quotes before cursor
    let inDouble = false;
    let inSingle = false;
    let inBacktick = false;

    for (let i = 0; i < beforeCursor.length; i++) {
      const char = beforeCursor[i];
      const prevChar = i > 0 ? beforeCursor[i - 1] : '';

      if (char === '"' && prevChar !== '\\' && !inSingle && !inBacktick) {
        inDouble = !inDouble;
      } else if (char === "'" && prevChar !== '\\' && !inDouble && !inBacktick) {
        inSingle = !inSingle;
      } else if (char === '`' && prevChar !== '\\' && !inDouble && !inSingle) {
        inBacktick = !inBacktick;
      }
    }

    return inDouble || inSingle || inBacktick;
  }

  updateSettings(settings: AutoCloseSettings): void {
    this.settings = settings;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
