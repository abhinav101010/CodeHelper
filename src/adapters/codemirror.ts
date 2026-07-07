import type { EditorAdapter, Disposable } from './types';
import type { Position, Range } from '../types/editor';

export class CodeMirror5Adapter implements EditorAdapter {
  readonly name = 'codemirror5';
  readonly editorType = 'codemirror5' as const;

  private editor: any;
  private container: HTMLElement;
  private disposables: Disposable[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.editor = this.getEditorInstance();
  }

  private getEditorInstance(): any {
    // CM5 stores instance on DOM element
    const cmElement = this.container.querySelector('.CodeMirror');
    if (cmElement) {
      return (cmElement as any).CodeMirror;
    }

    // Try container directly
    if ((this.container as any).CodeMirror) {
      return (this.container as any).CodeMirror;
    }

    return null;
  }

  getValue(): string {
    return this.editor?.getValue() ?? '';
  }

  setValue(text: string): void {
    this.editor?.setValue(text);
  }

  getSelection(): { start: Position; end: Position } {
    const sel = this.editor?.getSelection();
    if (!sel) {
      return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
    }

    const cursor = this.editor?.getCursor();
    return {
      start: { line: cursor?.line ?? 0, column: cursor?.ch ?? 0 },
      end: { line: cursor?.line ?? 0, column: cursor?.ch ?? 0 },
    };
  }

  setSelection(start: Position, end: Position): void {
    this.editor?.setSelection(
      { line: start.line, ch: start.column },
      { line: end.line, ch: end.column },
    );
  }

  getLine(lineNumber: number): string {
    return this.editor?.getLine(lineNumber) ?? '';
  }

  getLineCount(): number {
    return this.editor?.lineCount() ?? 0;
  }

  getCursorPosition(): Position {
    const cursor = this.editor?.getCursor();
    if (!cursor) {
      return { line: 0, column: 0 };
    }

    return {
      line: cursor.line,
      column: cursor.ch,
    };
  }

  setCursorPosition(pos: Position): void {
    this.editor?.setCursor({ line: pos.line, ch: pos.column });
  }

  replaceRange(range: Range, text: string): void {
    this.editor?.replaceRange(
      text,
      { line: range.start.line, ch: range.start.column },
      { line: range.end.line, ch: range.end.column },
    );
  }

  insertText(text: string): void {
    const cursor = this.getCursorPosition();
    this.replaceRange({ start: cursor, end: cursor }, text);
  }

  deleteRange(range: Range): void {
    this.replaceRange(range, '');
  }

  indentLine(lineNumber: number, direction: 'increase' | 'decrease'): void {
    if (direction === 'increase') {
      this.editor?.indentLine(lineNumber, 'add');
    } else {
      this.editor?.indentLine(lineNumber, 'subtract');
    }
  }

  onDidChangeContent(callback: () => void): Disposable {
    this.editor?.on('change', callback);
    return {
      dispose: () => this.editor?.off('change', callback),
    };
  }

  onKeyDown(callback: (e: KeyboardEvent) => boolean | void): Disposable {
    this.editor?.on('keydown', (cm: any, e: KeyboardEvent) => {
      const result = callback(e);
      if (result === false) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    return {
      dispose: () => {},
    };
  }

  onDidChangeCursorSelection(callback: () => void): Disposable {
    this.editor?.on('cursorActivity', callback);
    return {
      dispose: () => this.editor?.off('cursorActivity', callback),
    };
  }

  getContainerElement(): HTMLElement {
    return this.container;
  }

  getRootElement(): HTMLElement {
    return this.container.querySelector('.CodeMirror') ?? this.container;
  }

  getLanguage(): string {
    const mode = this.editor?.getOption('mode');
    return typeof mode === 'string' ? mode : 'unknown';
  }

  updateOptions(options: Record<string, unknown>): void {
    if (this.editor) {
      this.editor.setOption(options);
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

export class CodeMirror6Adapter implements EditorAdapter {
  readonly name = 'codemirror6';
  readonly editorType = 'codemirror6' as const;

  private editor: any;
  private container: HTMLElement;
  private disposables: Disposable[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.editor = this.getEditorInstance();
  }

  private getEditorInstance(): any {
    // CM6 stores view in cmView property
    const cmElement = this.container.querySelector('.cm-editor');
    if (cmElement) {
      return (cmElement as any).cmView?.view;
    }

    return null;
  }

  getValue(): string {
    return this.editor?.state.doc.toString() ?? '';
  }

  setValue(text: string): void {
    this.editor?.dispatch({
      changes: { from: 0, to: this.editor.state.doc.length, insert: text },
    });
  }

  getSelection(): { start: Position; end: Position } {
    const sel = this.editor?.state.selection.main;
    if (!sel) {
      return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
    }

    const start = this.editor?.state.doc.lineAt(sel.from);
    const end = this.editor?.state.doc.lineAt(sel.to);

    return {
      start: {
        line: (start?.number ?? 1) - 1,
        column: sel.from - (start?.from ?? 0),
      },
      end: {
        line: (end?.number ?? 1) - 1,
        column: sel.to - (end?.from ?? 0),
      },
    };
  }

  setSelection(start: Position, end: Position): void {
    const startLine = this.editor?.state.doc.line(start.line + 1);
    const endLine = this.editor?.state.doc.line(end.line + 1);

    if (startLine && endLine) {
      this.editor?.dispatch({
        selection: {
          anchor: startLine.from + start.column,
          head: endLine.from + end.column,
        },
      });
    }
  }

  getLine(lineNumber: number): string {
    try {
      const line = this.editor?.state.doc.line(lineNumber + 1);
      return line?.text ?? '';
    } catch {
      return '';
    }
  }

  getLineCount(): number {
    return this.editor?.state.doc.lines ?? 0;
  }

  getCursorPosition(): Position {
    const pos = this.editor?.state.selection.main.head;
    if (pos === undefined) {
      return { line: 0, column: 0 };
    }

    const line = this.editor?.state.doc.lineAt(pos);
    return {
      line: (line?.number ?? 1) - 1,
      column: pos - (line?.from ?? 0),
    };
  }

  setCursorPosition(pos: Position): void {
    try {
      const line = this.editor?.state.doc.line(pos.line + 1);
      if (line) {
        this.editor?.dispatch({
          selection: { anchor: line.from + pos.column },
        });
      }
    } catch {
      // Line doesn't exist
    }
  }

  replaceRange(range: Range, text: string): void {
    try {
      const startLine = this.editor?.state.doc.line(range.start.line + 1);
      const endLine = this.editor?.state.doc.line(range.end.line + 1);

      if (startLine && endLine) {
        this.editor?.dispatch({
          changes: {
            from: startLine.from + range.start.column,
            to: endLine.from + range.end.column,
            insert: text,
          },
        });
      }
    } catch {
      // Range invalid
    }
  }

  insertText(text: string): void {
    const cursor = this.getCursorPosition();
    this.replaceRange({ start: cursor, end: cursor }, text);
  }

  deleteRange(range: Range): void {
    this.replaceRange(range, '');
  }

  indentLine(lineNumber: number, direction: 'increase' | 'decrease'): void {
    // CM6 indentation is handled by the language extension
    // This is a basic implementation
    const line = this.getLine(lineNumber);
    const indent = line.match(/^\s*/)?.[0] ?? '';
    const indentSize = 2;
    const newIndent =
      direction === 'increase' ? indent + ' '.repeat(indentSize) : indent.slice(indentSize);

    this.replaceRange(
      {
        start: { line: lineNumber, column: 0 },
        end: { line: lineNumber, column: indent.length },
      },
      newIndent,
    );
  }

  onDidChangeContent(callback: () => void): Disposable {
    // CM6 uses a different event model
    // This is a simplified implementation
    return {
      dispose: () => {},
    };
  }

  onKeyDown(callback: (e: KeyboardEvent) => boolean | void): Disposable {
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
    // CM6 uses a different event model
    return {
      dispose: () => {},
    };
  }

  getContainerElement(): HTMLElement {
    return this.container;
  }

  getRootElement(): HTMLElement {
    return this.container.querySelector('.cm-editor') ?? this.container;
  }

  getLanguage(): string {
    // CM6 language detection is more complex
    return 'unknown';
  }

  updateOptions(_options: Record<string, unknown>): void {
    // CM6 uses a different configuration model - options are set via extensions
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

export function createCodeMirrorAdapter(container: HTMLElement): EditorAdapter | null {
  // Try CM6 first (newer)
  if (container.querySelector('.cm-editor')) {
    try {
      const adapter = new CodeMirror6Adapter(container);
      if ((adapter as any).editor) {
        return adapter;
      }
    } catch {
      // Fall through to CM5
    }
  }

  // Try CM5
  if (container.querySelector('.CodeMirror') || (container as any).CodeMirror) {
    try {
      const adapter = new CodeMirror5Adapter(container);
      if ((adapter as any).editor) {
        return adapter;
      }
    } catch {
      // Fall through
    }
  }

  return null;
}
