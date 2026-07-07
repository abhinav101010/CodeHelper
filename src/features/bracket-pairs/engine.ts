import { injectStyle, removeStyle } from '../../core/injector';
import type { EditorAdapter } from '../../adapters/types';

const STYLE_ID = 'ch-bracket-pairs';

export function applyBracketPairs(adapter: EditorAdapter): void {
  const css = `
    /* Monaco */
    .monaco-editor .bracket-pair-colorization-1 { color: var(--ch-bracketPair1) !important; }
    .monaco-editor .bracket-pair-colorization-2 { color: var(--ch-bracketPair2) !important; }
    .monaco-editor .bracket-pair-colorization-3 { color: var(--ch-bracketPair3) !important; }

    /* CodeMirror 6 */
    .cm-bracket-pair-1 { color: var(--ch-bracketPair1) !important; }
    .cm-bracket-pair-2 { color: var(--ch-bracketPair2) !important; }
    .cm-bracket-pair-3 { color: var(--ch-bracketPair3) !important; }
  `;

  injectStyle(STYLE_ID, css);
}

export function removeBracketPairs(): void {
  removeStyle(STYLE_ID);
}
