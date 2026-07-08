import type { EditorAdapter, Disposable } from './types';
import type { Position, Range } from '../types/editor';

declare const monaco: any;

export class MonacoAdapter implements EditorAdapter {
  readonly name = 'monaco';
  readonly editorType = 'monaco' as const;

  private editor: any = null;
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

  /**
   * Get the Monaco editor instance, specifically the editable code editor.
   * Uses multiple strategies to reliably find the code editor.
   */
  private getEditorInstance(): any {
    // Strategy 1: Use Monaco's global API with robust readOnly detection
    if (typeof monaco !== 'undefined' && monaco.editor) {
      const editors = monaco.editor.getEditors?.();
      if (editors && editors.length > 0) {
        // First: getRawOptions (most reliable)
        let codeEditor = editors.find((e: any) => {
          try {
            const rawOpts = e.getRawOptions?.();
            if (rawOpts && typeof rawOpts.readOnly === 'boolean') {
              return !rawOpts.readOnly;
            }
          } catch {
            // ignore
          }
          return false;
        });

        // Second: getOption(EditorOption.readOnly) — commonly 89
        if (!codeEditor) {
          codeEditor = editors.find((e: any) => {
            try {
              const readOnly = e.getOption?.(89) ?? e.getOption?.('readOnly');
              return readOnly === false;
            } catch {
              return false;
            }
          });
        }

        // Third: editor with model content
        if (!codeEditor) {
          codeEditor = editors.find((e: any) => {
            try {
              const model = e.getModel?.();
              return model && typeof model.getValue === 'function' && model.getValue().length > 0;
            } catch {
              return false;
            }
          });
        }

        // Fallback: last editor
        return codeEditor || editors[editors.length - 1];
      }
    }

    // Strategy 2: DOM-based search
    const allEditors = document.querySelectorAll('.monaco-editor');
    for (const editorElement of allEditors) {
      if (!editorElement || editorElement === this.container) continue;
      const keys = Object.getOwnPropertyNames(editorElement);
      for (const key of keys) {
        try {
          const value = (editorElement as any)[key];
          if (value && typeof value.getModel === 'function') {
            const model = value.getModel?.();
            if (model) return value;
          }
        } catch {
          // Skip inaccessible properties
        }
      }
    }

    // Strategy 3: Check this.container
    if (this.container) {
      const keys = Object.getOwnPropertyNames(this.container);
      for (const key of keys) {
        try {
          const value = (this.container as any)[key];
          if (value && typeof value.getModel === 'function') {
            const model = value.getModel?.();
            if (model) return value;
          }
        } catch {
          // Skip inaccessible properties
        }
      }
    }

    return null;
  }

  /** Re-find the editor instance (useful after SPA navigation). */
  refreshEditor(): void {
    const newEditor = this.getEditorInstance();
    if (newEditor && newEditor !== this.editor) {
      console.log('[CodeHelper] MonacoAdapter: refreshed editor instance');
      this.editor = newEditor;
    }
  }

  /**
   * Wait for the editor to become available, polling every 300ms.
   * Resolves with the editor instance or rejects after timeout.
   */
  waitForEditor(timeout = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      // Check if we already have one
      if (this.editor) {
        resolve(this.editor);
        return;
      }

      const interval = setInterval(() => {
        this.refreshEditor();
        if (this.editor) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(this.editor);
        }
      }, 300);

      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`MonacoAdapter: editor not found within ${timeout}ms`));
      }, timeout);
    });
  }

  // ── Text operations ──────────────────────────────────────────────────────

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
      start: { line: selection.startLineNumber - 1, column: selection.startColumn - 1 },
      end: { line: selection.endLineNumber - 1, column: selection.endColumn - 1 },
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
    if (!position) return { line: 0, column: 0 };
    return { line: position.lineNumber - 1, column: position.column - 1 };
  }

  setCursorPosition(pos: Position): void {
    this.editor?.setPosition({ lineNumber: pos.line + 1, column: pos.column + 1 });
  }

  // ── Editing ──────────────────────────────────────────────────────────────

  replaceRange(range: Range, text: string): void {
    const monacoRange = {
      startLineNumber: range.start.line + 1,
      startColumn: range.start.column + 1,
      endLineNumber: range.end.line + 1,
      endColumn: range.end.column + 1,
    };

    this.editor?.executeEdits('codehelper', [{ range: monacoRange, text, forceMoveMarkers: true }]);
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

  // ── Events ───────────────────────────────────────────────────────────────

  onDidChangeContent(callback: () => void): Disposable {
    const disposable = this.editor?.onDidChangeModelContent(callback);
    return { dispose: () => disposable?.dispose() };
  }

  onKeyDown(callback: (e: KeyboardEvent) => boolean | void): Disposable {
    const disposable = this.editor?.onKeyDown((monacoEvent: any) => {
      try {
        const rawKey = monacoEvent.key;
        const safeKey = rawKey != null ? String(rawKey) : '';
        const safeEvent: Partial<KeyboardEvent> = {
          key: safeKey,
          code: monacoEvent.code ?? '',
          ctrlKey: !!monacoEvent.ctrlKey,
          shiftKey: !!monacoEvent.shiftKey,
          altKey: !!monacoEvent.altKey,
          metaKey: !!monacoEvent.metaKey,
          preventDefault: () => monacoEvent.preventDefault?.(),
          stopPropagation: () => monacoEvent.stopPropagation?.(),
        };
        const result = callback(safeEvent as KeyboardEvent);
        if (result === false) {
          monacoEvent.preventDefault();
          monacoEvent.stopPropagation();
        }
      } catch (err) {
        console.warn('[CodeHelper] onKeyDown handler threw:', err);
      }
    });
    return { dispose: () => disposable?.dispose() };
  }

  onDidChangeCursorSelection(callback: () => void): Disposable {
    const disposable = this.editor?.onDidChangeCursorSelection(callback);
    return { dispose: () => disposable?.dispose() };
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  getContainerElement(): HTMLElement {
    return this.container;
  }

  getRootElement(): HTMLElement {
    return this.container.querySelector('.monaco-editor') ?? this.container;
  }

  // ── Language ─────────────────────────────────────────────────────────────

  getLanguage(): string {
    const model = this.editor?.getModel();
    return model?.getLanguageId() ?? 'unknown';
  }

  // ── Options ──────────────────────────────────────────────────────────────

  updateOptions(options: Record<string, unknown>): void {
    this.editor?.updateOptions(options);
  }

  // ── Raw access ───────────────────────────────────────────────────────────

  /**
   * Get the raw Monaco editor instance.
   * Only available when editorType === 'monaco'.
   */
  getMonacoEditor(): any {
    return this.editor;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
    this.disposables = [];
    this.editor = null;
  }
}

export function createMonacoAdapter(containerOrEditor: HTMLElement | any): MonacoAdapter | null {
  try {
    const adapter = new MonacoAdapter(containerOrEditor);
    if ((adapter as any).editor) {
      return adapter;
    }
    return null;
  } catch {
    return null;
  }
}
