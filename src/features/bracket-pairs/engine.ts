import { injectStyle, removeStyle } from '../../core/injector';
import type { EditorAdapter } from '../../adapters/types';

const STYLE_ID = 'ch-bracket-pairs';

export function applyBracketPairs(adapter: EditorAdapter): void {
  // Enable Monaco's built-in bracket pair colorization (v1.60+) when available
  try {
    if (adapter.editorType === 'monaco') {
      adapter.updateOptions({
        'bracketPairColorization.enabled': true,
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        matchingBracket: 'always',
      });
    }
  } catch {
    // Monaco version may not support this option
  }

  const css = `
    /* ══════════════════════════════════════════════════════════════
       Rainbow Brackets — 6 levels + matching bracket highlight
       ══════════════════════════════════════════════════════════════ */

    /* Level 1 – Red */
    .monaco-editor .bracket-pair-colorization-1,
    .bracket-highlighting-0 {
      color: var(--ch-bracketPair1) !important;
      font-weight: bold;
    }

    /* Level 2 – Purple */
    .monaco-editor .bracket-pair-colorization-2,
    .bracket-highlighting-1 {
      color: var(--ch-bracketPair2) !important;
      font-weight: bold;
    }

    /* Level 3 – Blue */
    .monaco-editor .bracket-pair-colorization-3,
    .bracket-highlighting-2 {
      color: var(--ch-bracketPair3) !important;
      font-weight: bold;
    }

    /* Level 4 – Green */
    .monaco-editor .bracket-pair-colorization-4,
    .bracket-highlighting-3 {
      color: var(--ch-bracketPair4) !important;
      font-weight: bold;
    }

    /* Level 5 – Orange */
    .monaco-editor .bracket-pair-colorization-5,
    .bracket-highlighting-4 {
      color: var(--ch-bracketPair5) !important;
      font-weight: bold;
    }

    /* Level 6 – Cyan */
    .monaco-editor .bracket-pair-colorization-6,
    .bracket-highlighting-5 {
      color: var(--ch-bracketPair6) !important;
      font-weight: bold;
    }

    /* Matching bracket highlight – a subtle background glow */
    .monaco-editor .bracket-match,
    .monaco-editor .bracket-highlighting-0::before,
    .monaco-editor .bracket-highlighting-1::before,
    .monaco-editor .bracket-highlighting-2::before,
    .monaco-editor .bracket-highlighting-3::before,
    .monaco-editor .bracket-highlighting-4::before,
    .monaco-editor .bracket-highlighting-5::before {
      outline: 1px solid var(--ch-bracketPair1, #ffd700) !important;
      background-color: color-mix(in srgb, var(--ch-matchingBracket, #b0b0b0) 30%, transparent) !important;
    }

    /* Monaco's unbound matching bracket border */
    .monaco-editor .bracket-match.bracket-highlighting-0,
    .monaco-editor .bracket-match.bracket-highlighting-1,
    .monaco-editor .bracket-match.bracket-highlighting-2,
    .monaco-editor .bracket-match.bracket-highlighting-3,
    .monaco-editor .bracket-match.bracket-highlighting-4,
    .monaco-editor .bracket-match.bracket-highlighting-5 {
      border: 0 !important;
      outline: 1px solid var(--ch-matchingBracket, #b0b0b0) !important;
      background-color: color-mix(in srgb, var(--ch-matchingBracket, #b0b0b0) 25%, transparent) !important;
    }

    /* CodeMirror 6 bracket colors (fallback) */
    .cm-editor .cm-bracket-pair-1 { color: var(--ch-bracketPair1) !important; font-weight: bold; }
    .cm-editor .cm-bracket-pair-2 { color: var(--ch-bracketPair2) !important; font-weight: bold; }
    .cm-editor .cm-bracket-pair-3 { color: var(--ch-bracketPair3) !important; font-weight: bold; }
    .cm-editor .cm-bracket-pair-4 { color: var(--ch-bracketPair4) !important; font-weight: bold; }
    .cm-editor .cm-bracket-pair-5 { color: var(--ch-bracketPair5) !important; font-weight: bold; }
    .cm-editor .cm-bracket-pair-6 { color: var(--ch-bracketPair6) !important; font-weight: bold; }
  `;

  injectStyle(STYLE_ID, css);
}

export function removeBracketPairs(): void {
  removeStyle(STYLE_ID);
}
