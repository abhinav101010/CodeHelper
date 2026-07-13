/**
 * HTML language extractor.
 *
 * Collects custom element names (x-foo).
 * Minimal — most HTML identifiers come from snippets
 * and are not meaningful for autocomplete in the
 * context of competitive programming.
 *
 * This extractor can be extended later for projects
 * using Web Components or template engines.
 */

import type { DocumentSymbol } from '../DocumentSymbol';

export function extractHtmlSymbols(
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const trimmed = line.trimStart();

  // ── Custom elements: <x-foo> or </x-foo> ──────────────────────────
  // Custom element names contain a hyphen
  let m = trimmed.match(/<([a-z]+-[a-zA-Z][a-zA-Z0-9_-]*)(?:\s|>|\/)/);
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Template variables: {{ varName }} ─────────────────────────────
  m = trimmed.match(/\{\{\s*([a-zA-Z_]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── id attributes ─────────────────────────────────────────────────
  m = trimmed.match(/id\s*=\s*['"]([a-zA-Z_]\w*)['"]/i);
  if (m) {
    callback({ name: m[1], kind: 'constant', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── class attributes (extract class names) ────────────────────────
  m = trimmed.match(/class\s*=\s*['"]([^'"]+)['"]/i);
  if (m) {
    const classNames = m[1].split(/\s+/);
    for (const cls of classNames) {
      if (cls && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(cls)) {
        callback({ name: cls, kind: 'class', line: lineIdx, column: line.indexOf(cls), declarationLine: lineIdx, declarationColumn: line.indexOf(cls) });
      }
    }
    return;
  }

  // ── name attributes (form elements) ───────────────────────────────
  m = trimmed.match(/name\s*=\s*['"]([a-zA-Z_]\w*)['"]/i);
  if (m) {
    callback({ name: m[1], kind: 'field', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── ng-model / v-model / etc. (framework bindings) ────────────────
  m = trimmed.match(/(?:ng-model|v-model|:value|v-bind)\s*=\s*['"]?([a-zA-Z_]\w*)['"]?/i);
  if (m) {
    callback({ name: m[1], kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }
}
