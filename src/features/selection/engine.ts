import { injectStyle, removeStyle } from '../../core/injector';
import type { SelectionSettings } from '../../types/settings';
import type { EditorAdapter } from '../../adapters/types';

const STYLE_ID = 'ch-selection';

export function applySelectionStyle(
  adapter: EditorAdapter,
  settings: SelectionSettings,
): void {
  if (adapter.editorType === 'monaco') {
    // Monaco handles selection via theme colors
    return;
  }

  const css = `
    /* Ace */
    .ace_editor .ace_selection {
      background-color: ${settings.backgroundColor} !important;
      color: ${settings.foregroundColor} !important;
    }

    /* CodeMirror 5 */
    .CodeMirror-selected {
      background-color: ${settings.backgroundColor} !important;
      color: ${settings.foregroundColor} !important;
    }

    /* CodeMirror 6 */
    .cm-selectionBackground {
      background-color: ${settings.backgroundColor} !important;
      color: ${settings.foregroundColor} !important;
    }
    .cm-editor .cm-selectionMatch {
      background-color: ${settings.backgroundColor} !important;
    }
  `;

  injectStyle(STYLE_ID, css);
}

export function removeSelectionStyle(): void {
  removeStyle(STYLE_ID);
}
