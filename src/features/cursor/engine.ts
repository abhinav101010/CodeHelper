import { injectStyle, removeStyle } from '../../core/injector';
import type { CursorSettings } from '../../types/settings';
import type { EditorAdapter } from '../../adapters/types';

const STYLE_ID = 'ch-cursor';

export function applyCursorStyle(adapter: EditorAdapter, settings: CursorSettings): void {
  if (adapter.editorType === 'monaco') {
    // Monaco handles cursor via theme and options
    return;
  }

  const css = `
    /* Ace */
    .ace_editor .ace_cursor {
      width: ${settings.width}px !important;
      background-color: ${settings.color} !important;
    }

    /* CodeMirror 5 */
    .CodeMirror-cursor {
      border-left-width: ${settings.width}px !important;
      border-left-color: ${settings.color} !important;
    }

    /* CodeMirror 6 */
    .cm-cursor {
      border-left-width: ${settings.width}px !important;
      border-left-color: ${settings.color} !important;
    }
  `;

  injectStyle(STYLE_ID, css);
}

export function removeCursorStyle(): void {
  removeStyle(STYLE_ID);
}
