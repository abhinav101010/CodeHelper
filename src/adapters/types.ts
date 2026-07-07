import type { Position, Range, EditorType } from '../types/editor';

export interface Disposable {
  dispose(): void;
}

export interface EditorAdapter {
  readonly name: string;
  readonly editorType: EditorType;

  // Core text operations
  getValue(): string;
  setValue(text: string): void;
  getSelection(): { start: Position; end: Position };
  setSelection(start: Position, end: Position): void;
  getLine(lineNumber: number): string;
  getLineCount(): number;
  getCursorPosition(): Position;
  setCursorPosition(pos: Position): void;

  // Editing operations
  replaceRange(range: Range, text: string): void;
  insertText(text: string): void;
  deleteRange(range: Range): void;
  indentLine(lineNumber: number, direction: 'increase' | 'decrease'): void;

  // Event system
  onDidChangeContent(callback: () => void): Disposable;
  onKeyDown(callback: (e: KeyboardEvent) => boolean | void): Disposable;
  onDidChangeCursorSelection(callback: () => void): Disposable;

  // DOM access
  getContainerElement(): HTMLElement;
  getRootElement(): HTMLElement;

  // Language
  getLanguage(): string;

  // Editor options
  updateOptions(options: Record<string, unknown>): void;

  // Lifecycle
  dispose(): void;
}

export class CompositeDisposable implements Disposable {
  private items: Disposable[] = [];

  add(d: Disposable): void {
    this.items.push(d);
  }

  dispose(): void {
    this.items.forEach((d) => d.dispose());
    this.items = [];
  }
}
