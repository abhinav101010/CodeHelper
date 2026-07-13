/**
 * CSS language extractor.
 *
 * Collects:
 *   custom properties (--var-name),
 *   class selectors, ID selectors,
 *   @keyframes names, @font-face names.
 *
 * CSS suggestions are less critical for LeetCode but we
 * still provide basic support for completeness.
 */

import type { DocumentSymbol } from '../DocumentSymbol';

export function extractCssSymbols(
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const trimmed = line.trimStart();

  // Skip comments
  if (trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

  // ── Custom properties: --var-name: value; ─────────────────────────
  let m = trimmed.match(/^--([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/);
  if (m) {
    callback({ name: `--${m[1]}`, kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── @keyframes name ───────────────────────────────────────────────
  m = trimmed.match(/^@keyframes\s+([a-zA-Z_][a-zA-Z0-9_-]*)/);
  if (m) {
    callback({ name: m[1], kind: 'function', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── @font-face family name ────────────────────────────────────────
  m = trimmed.match(/^@font-face\s*\{/);
  if (m) {
    // Don't extract here — the font-family is on a nested line
    return;
  }

  // ── Font family in @font-face ─────────────────────────────────────
  m = trimmed.match(/font-family:\s*['"]([^'"]+)['"]/i);
  if (m) {
    const name = m[1].replace(/\s+/g, '-');
    if (name) {
      callback({ name, kind: 'constant', line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    }
    return;
  }

  // ── Class selectors (when used as definition, e.g., .class-name {) ──
  m = trimmed.match(/^\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*(?:\{|,)/);
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── ID selectors (when used as definition, e.g., #id-name {) ────
  m = trimmed.match(/^#([a-zA-Z_][a-zA-Z0-9_-]*)\s*(?:\{|,)/);
  if (m) {
    callback({ name: m[1], kind: 'constant', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── @property custom property registration ────────────────────────
  m = trimmed.match(/^@property\s+--([a-zA-Z_][a-zA-Z0-9_-]*)/);
  if (m) {
    callback({ name: `--${m[1]}`, kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }
}
