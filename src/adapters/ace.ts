import type { EditorAdapter, Disposable } from './types';
import type { Position, Range } from '../types/editor';

export class AceAdapter implements EditorAdapter {
  readonly name = 'ace';
  readonly editorType = 'ace' as const;

  private editor: any;
  private container: HTMLElement;
  private disposables: Disposable[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.editor = this.getEditorInstance();
  }

  private getEditorInstance(): any {
    // Ace stores editor instance on the DOM element
    const aceElement = this.container.querySelector('.ace_editor');
    if (aceElement) {
      return (aceElement as any).env?.editor ?? (aceElement as any).ace_editor;
    }

    // Try to get from container directly
    if ((this.container as any).env?.editor) {
      return (this.container as any).env.editor;
    }

    return null;
  }

  getValue(): string {
    return this.editor?.getValue() ?? '';
  }

  setValue(text: string): void {
    this.editor?.setValue(text, -1);
  }

  getSelection(): { start: Position; end: Position } {
    const selection = this.editor?.getSelectionRange();
    if (!selection) {
      return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
    }

    return {
      start: {
        line: selection.start.row,
        column: selection.start.column,
      },
      end: {
        line: selection.end.row,
        column: selection.end.column,
      },
    };
  }

  setSelection(start: Position, end: Position): void {
    this.editor?.selection.setRange({
      start: { row: start.line, column: start.column },
      end: { row: end.line, column: end.column },
    });
  }

  getLine(lineNumber: number): string {
    return this.editor?.getSession()?.getLine(lineNumber) ?? '';
  }

  getLineCount(): number {
    return this.editor?.getSession()?.getLength() ?? 0;
  }

  getCursorPosition(): Position {
    const cursor = this.editor?.getCursorPosition();
    if (!cursor) {
      return { line: 0, column: 0 };
    }

    return {
      line: cursor.row,
      column: cursor.column,
    };
  }

  setCursorPosition(pos: Position): void {
    this.editor?.gotoLine(pos.line + 1, pos.column, false);
  }

  replaceRange(range: Range, text: string): void {
    const session = this.editor?.getSession();
    if (!session) return;

    const Range = (window as any).ace?.Range;
    if (!Range) return;

    const aceRange = new Range(
      range.start.line,
      range.start.column,
      range.end.line,
      range.end.column,
    );

    session.replace(aceRange, text);
  }

  insertText(text: string): void {
    this.editor?.insert(text);
  }

  deleteRange(range: Range): void {
    this.replaceRange(range, '');
  }

  indentLine(lineNumber: number, direction: 'increase' | 'decrease'): void {
    if (direction === 'increase') {
      this.editor?.indent();
    } else {
      this.editor?.outdent();
    }
  }

  onDidChangeContent(callback: () => void): Disposable {
    const session = this.editor?.getSession();
    session?.on('change', callback);
    return {
      dispose: () => session?.removeListener('change', callback),
    };
  }

  onKeyDown(callback: (e: KeyboardEvent) => boolean | void): Disposable {
    this.editor?.commands?.addCommand({
      name: 'codehelper-keydown',
      bindKey: null,
      exec: () => {},
    });

    const handler = (e: KeyboardEvent) => {
      const result = callback(e);
      if (result === false) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    this.container.addEventListener('keydown', handler);
    return {
      dispose: () => this.container.removeEventListener('keydown', handler),
    };
  }

  onDidChangeCursorSelection(callback: () => void): Disposable {
    const session = this.editor?.getSession();
    session?.on('changeSelection', callback);
    return {
      dispose: () => session?.removeListener('changeSelection', callback),
    };
  }

  getContainerElement(): HTMLElement {
    return this.container;
  }

  getRootElement(): HTMLElement {
    return this.container.querySelector('.ace_editor') ?? this.container;
  }

  getLanguage(): string {
    const session = this.editor?.getSession();
    const mode = session?.getMode()?.$id ?? '';
    return mode.split('/').pop() ?? 'unknown';
  }

  updateOptions(options: Record<string, unknown>): void {
    if (this.editor) {
      for (const [key, value] of Object.entries(options)) {
        this.editor.setOption(key, value);
      }
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

export function createAceAdapter(container: HTMLElement): AceAdapter | null {
  try {
    const adapter = new AceAdapter(container);
    if ((adapter as any).editor) {
      return adapter;
    }
    return null;
  } catch {
    return null;
  }
}
