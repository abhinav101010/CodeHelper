import type { EditorAdapter } from '../../adapters/types';
import type { ShortcutSettings } from '../../types/settings';
import { DEFAULT_SHORTCUTS } from './defaults';
import type { ShortcutDefinition } from '../../types/shortcuts';

function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

function getCommentString(language: string): string {
  const map: Record<string, string> = {
    cpp: '//',
    c: '//',
    java: '//',
    javascript: '//',
    js: '//',
    python: '#',
    python3: '#',
    go: '//',
    rust: '//',
  };
  return map[language] ?? '//';
}

export class ShortcutEngine {
  private adapter: EditorAdapter;
  private settings: ShortcutSettings;
  private disposables: Array<{ dispose(): void }> = [];

  constructor(adapter: EditorAdapter, settings: ShortcutSettings) {
    this.adapter = adapter;
    this.settings = settings;
    this.registerShortcuts();
  }

  private registerShortcuts(): void {
    const shortcuts = {
      ...DEFAULT_SHORTCUTS,
      ...this.settings.mappings,
    };

    const disposable = this.adapter.onKeyDown((e: KeyboardEvent) => {
      for (const [id, def] of Object.entries(shortcuts)) {
        if (this.matchesShortcut(e, def)) {
          this.executeAction(id);
          return false;
        }
      }
      return true;
    });

    this.disposables.push(disposable);
  }

  private matchesShortcut(e: KeyboardEvent, def: ShortcutDefinition): boolean {
    if (!def?.keys) return false;
    const keyStr = isMac() ? def.keys.mac : def.keys.win;
    if (!keyStr) return false;
    const parts = keyStr.split('+');

    const key = parts[parts.length - 1].toLowerCase();
    const ctrl = parts.includes('Ctrl') || parts.includes('Cmd');
    const shift = parts.includes('Shift');
    const alt = parts.includes('Alt') || parts.includes('Option');

    return (
      e.key.toLowerCase() === key &&
      e.ctrlKey === ctrl &&
      e.shiftKey === shift &&
      e.altKey === alt
    );
  }

  private executeAction(actionId: string): void {
    switch (actionId) {
      case 'duplicateLine':
        this.duplicateLine();
        break;
      case 'deleteLine':
        this.deleteLine();
        break;
      case 'moveLineUp':
        this.moveLineUp();
        break;
      case 'moveLineDown':
        this.moveLineDown();
        break;
      case 'toggleComment':
        this.toggleComment();
        break;
      case 'selectLine':
        this.selectLine();
        break;
    }
  }

  private duplicateLine(): void {
    const cursor = this.adapter.getCursorPosition();
    const line = this.adapter.getLine(cursor.line);
    const insertPos = { line: cursor.line + 1, column: 0 };
    this.adapter.replaceRange({ start: insertPos, end: insertPos }, line + '\n');
  }

  private deleteLine(): void {
    const cursor = this.adapter.getCursorPosition();
    const lineCount = this.adapter.getLineCount();

    if (lineCount <= 1) {
      // Delete all content
      this.adapter.replaceRange(
        {
          start: { line: 0, column: 0 },
          end: { line: 0, column: this.adapter.getLine(0).length },
        },
        '',
      );
    } else if (cursor.line === lineCount - 1) {
      // Delete last line
      const prevLine = this.adapter.getLine(cursor.line - 1);
      this.adapter.replaceRange(
        {
          start: { line: cursor.line - 1, column: prevLine.length },
          end: { line: cursor.line, column: 0 },
        },
        '',
      );
    } else {
      // Delete current line
      const line = this.adapter.getLine(cursor.line);
      this.adapter.replaceRange(
        {
          start: { line: cursor.line, column: 0 },
          end: { line: cursor.line + 1, column: 0 },
        },
        '',
      );
    }
  }

  private moveLineUp(): void {
    const cursor = this.adapter.getCursorPosition();
    if (cursor.line === 0) return;

    const currentLine = this.adapter.getLine(cursor.line);
    const prevLine = this.adapter.getLine(cursor.line - 1);

    this.adapter.replaceRange(
      {
        start: { line: cursor.line - 1, column: 0 },
        end: { line: cursor.line, column: currentLine.length },
      },
      currentLine + '\n' + prevLine,
    );

    this.adapter.setCursorPosition({
      line: cursor.line - 1,
      column: cursor.column,
    });
  }

  private moveLineDown(): void {
    const cursor = this.adapter.getCursorPosition();
    const lineCount = this.adapter.getLineCount();
    if (cursor.line >= lineCount - 1) return;

    const currentLine = this.adapter.getLine(cursor.line);
    const nextLine = this.adapter.getLine(cursor.line + 1);

    this.adapter.replaceRange(
      {
        start: { line: cursor.line, column: 0 },
        end: { line: cursor.line + 1, column: nextLine.length },
      },
      nextLine + '\n' + currentLine,
    );

    this.adapter.setCursorPosition({
      line: cursor.line + 1,
      column: cursor.column,
    });
  }

  private toggleComment(): void {
    const selection = this.adapter.getSelection();
    const language = this.adapter.getLanguage();
    const commentStr = getCommentString(language);

    for (let line = selection.start.line; line <= selection.end.line; line++) {
      const text = this.adapter.getLine(line);
      const trimmed = text.trimStart();

      if (trimmed.startsWith(commentStr)) {
        // Uncomment: remove comment prefix
        const indent = text.length - trimmed.length;
        this.adapter.replaceRange(
          {
            start: { line, column: indent },
            end: { line, column: indent + commentStr.length + 1 },
          },
          '',
        );
      } else {
        // Comment: add comment prefix after indentation
        const indent = text.length - trimmed.length;
        this.adapter.replaceRange(
          {
            start: { line, column: indent },
            end: { line, column: indent },
          },
          commentStr + ' ',
        );
      }
    }
  }

  private selectLine(): void {
    const cursor = this.adapter.getCursorPosition();
    const line = this.adapter.getLine(cursor.line);

    this.adapter.setSelection(
      { line: cursor.line, column: 0 },
      { line: cursor.line, column: line.length },
    );
  }

  updateSettings(settings: ShortcutSettings): void {
    this.settings = settings;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
