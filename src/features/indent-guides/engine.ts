import { injectStyle, removeStyle } from '../../core/injector';
import type { IndentGuideSettings } from '../../types/settings';
import type { EditorAdapter } from '../../adapters/types';

const STYLE_ID = 'ch-indent-guides';

export function applyIndentGuides(
  adapter: EditorAdapter,
  settings: IndentGuideSettings,
): void {
  const css = `
    /* Monaco indent guides */
    .monaco-editor .indent-guide {
      border-color: ${settings.color} !important;
    }
    /* CodeMirror 6 indent guides */
    .cm-indentGuide {
      border-left-color: ${settings.color} !important;
    }
    /* CodeMirror 5 */
    .CodeMirror-indent-guide {
      border-left-color: ${settings.color} !important;
    }
  `;

  injectStyle(STYLE_ID, css);
}

export function removeIndentGuides(): void {
  removeStyle(STYLE_ID);
}
