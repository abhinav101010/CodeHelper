import type { EditorAdapter, Disposable } from './types';
import type { Position, Range } from '../types/editor';

declare const monaco: any;

export class MonacoAdapter implements EditorAdapter {
  readonly name = 'monaco';
  readonly editorType = 'monaco' as const;

  private editor: any;
  private container: HTMLElement;
  private disposables: Disposable[] = [];

  constructor(containerOrEditor: HTMLElement | any) {
    // If passed a Monaco editor instance directly (has getModel), use it
    if (containerOrEditor && typeof containerOrEditor.getModel === 'function') {
      this.editor = containerOrEditor;
      // Find the DOM container from the editor
      this.container = containerOrEditor.getDomNode?.()?.closest('.monaco-editor') ?? document.body;
    } else {
      this.container = containerOrEditor;
      this.editor = this.getEditorInstance();
    }
  }

  private getEditorInstance(): any {
    // Try to get editor from Monaco's global API (works in MAIN world)
    if (typeof monaco !== 'undefined' && monaco.editor) {
      const editors = monaco.editor.getEditors();
      if (editors.length > 0) {
        // LeetCode has multiple editors (problem description + code editor).
        // The problem description editor is read-only; pick the editable one (code editor).
        // This is the primary fix for autocomplete not working on LeetCode.
        const codeEditor = editors.find((e: any) => {
          try {
            // Check readOnly via Monaco's option API
            const rawOpts = e.getRawOptions?.();
            if (rawOpts && 'readOnly' in rawOpts) {
              return !rawOpts.readOnly;
            }
            // Fallback: if we can inspect getOption directly
            if (typeof e.getOption === 'function') {
              return !e.getOption('readOnly');
            }
            return true;
          } catch {
            return false;
          }
        });
        return codeEditor || editors[editors.length - 1];
      }
    }

    // DOM-based fallback: search ALL .monaco-editor elements on the page,
    // not just within this.container, because this.container may be the
    // read-only problem description editor rather than the code editor.
    const allEditors = document.querySelectorAll('.monaco-editor');
    for (const editorElement of allEditors) {
      if (!editorElement || editorElement === this.container) continue;
      // Check common internal property patterns
      const keys = Object.getOwnPropertyNames(editorElement);
      for (const key of keys) {
        try {
          const value = (editorElement as any)[key];
          if (value && typeof value.getModel === 'function') {
            return value;
          }
        } catch {
          // Skip inaccessible properties
        }
      }
    }

    // Last resort: check this.container with property traversal
    if (this.container) {
      const keys = Object.getOwnPropertyNames(this.container);
      for (const key of keys) {
        try {
          const value = (this.container as any)[key];
          if (value && typeof value.getModel === 'function') {
            return value;
          }
        } catch {
          // Skip inaccessible properties
        }
      }
    }

    return null;
  }

  getValue(): string {
    return this.editor?.getModel()?.getValue() ?? '';
  }

  setValue(text: string): void {
    this.editor?.getModel()?.setValue(text);
  }

  getSelection(): { start: Position; end: Position } {
    const selection = this.editor?.getSelection();
    if (!selection) {
      return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
    }

    return {
      start: {
        line: selection.startLineNumber - 1,
        column: selection.startColumn - 1,
      },
      end: {
        line: selection.endLineNumber - 1,
        column: selection.endColumn - 1,
      },
    };
  }

  setSelection(start: Position, end: Position): void {
    this.editor?.setSelection({
      startLineNumber: start.line + 1,
      startColumn: start.column + 1,
      endLineNumber: end.line + 1,
      endColumn: end.column + 1,
    });
  }

  getLine(lineNumber: number): string {
    return this.editor?.getModel()?.getLineContent(lineNumber + 1) ?? '';
  }

  getLineCount(): number {
    return this.editor?.getModel()?.getLineCount() ?? 0;
  }

  getCursorPosition(): Position {
    const position = this.editor?.getPosition();
    if (!position) {
      return { line: 0, column: 0 };
    }

    return {
      line: position.lineNumber - 1,
      column: position.column - 1,
    };
  }

  setCursorPosition(pos: Position): void {
    this.editor?.setPosition({
      lineNumber: pos.line + 1,
      column: pos.column + 1,
    });
  }

  replaceRange(range: Range, text: string): void {
    const monacoRange = {
      startLineNumber: range.start.line + 1,
      startColumn: range.start.column + 1,
      endLineNumber: range.end.line + 1,
      endColumn: range.end.column + 1,
    };

    this.editor?.executeEdits('codehelper', [
      {
        range: monacoRange,
        text: text,
        forceMoveMarkers: true,
      },
    ]);
  }

  insertText(text: string): void {
    const cursor = this.getCursorPosition();
    this.replaceRange({ start: cursor, end: cursor }, text);
  }

  deleteRange(range: Range): void {
    this.replaceRange(range, '');
  }

  indentLine(lineNumber: number, direction: 'increase' | 'decrease'): void {
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
    const disposable = this.editor?.onDidChangeModelContent(callback);
    return {
      dispose: () => disposable?.dispose(),
    };
  }

  onKeyDown(callback: (e: KeyboardEvent) => boolean | void): Disposable {
    const disposable = this.editor?.onKeyDown((e: any) => {
      const result = callback(e);
      if (result === false) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    return {
      dispose: () => disposable?.dispose(),
    };
  }

  onDidChangeCursorSelection(callback: () => void): Disposable {
    const disposable = this.editor?.onDidChangeCursorSelection(callback);
    return {
      dispose: () => disposable?.dispose(),
    };
  }

  getContainerElement(): HTMLElement {
    return this.container;
  }

  getRootElement(): HTMLElement {
    return this.container.querySelector('.monaco-editor') ?? this.container;
  }

  getLanguage(): string {
    const model = this.editor?.getModel();
    return model?.getLanguageId() ?? 'unknown';
  }

  updateOptions(options: Record<string, unknown>): void {
    this.editor?.updateOptions(options);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

export function createMonacoAdapter(containerOrEditor: HTMLElement | any): MonacoAdapter | null {
  try {
    const adapter = new MonacoAdapter(containerOrEditor);
    if (adapter.editor) {
      return adapter;
    }
    return null;
  } catch {
    return null;
  }
}
