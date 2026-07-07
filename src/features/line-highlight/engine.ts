import { injectStyle, removeStyle } from '../../core/injector';
import type { LineHighlightSettings } from '../../types/settings';
import type { EditorAdapter } from '../../adapters/types';

const STYLE_ID = 'ch-line-highlight';

export function applyLineHighlight(
  adapter: EditorAdapter,
  settings: LineHighlightSettings,
): void {
  if (adapter.editorType === 'monaco') {
    // Monaco handles line highlight via theme colors
    return;
  }

  const css = `
    /* Ace */
    .ace_editor .ace_active-line {
      background-color: ${settings.color} !important;
      opacity: ${settings.opacity} !important;
    }
    /* CodeMirror 5 */
    .CodeMirror-activeline-background {
      background-color: ${settings.color} !important;
      opacity: ${settings.opacity} !important;
    }
    /* CodeMirror 6 */
    .cm-activeLine {
      background-color: ${settings.color} !important;
      opacity: ${settings.opacity} !important;
    }
  `;

  injectStyle(STYLE_ID, css);
}

export function removeLineHighlight(): void {
  removeStyle(STYLE_ID);
}
