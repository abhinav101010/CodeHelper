/**
 * TypeScript language extractor.
 *
 * Builds on the JavaScript extractor with additional support for:
 *   interface, type alias, enum, decorators,
 *   generic type parameters.
 *
 * Since TypeScript is a superset of JavaScript, this wraps
 * the JS extractor and adds TS-specific constructs.
 */

import type { DocumentSymbol, SymbolKind } from '../DocumentSymbol';
import { extractJavaScriptSymbols } from './javascript';

const TS_KEYWORDS = new Set([
  'interface', 'type', 'as', 'any', 'never', 'unknown', 'void',
  'null', 'undefined', 'string', 'number', 'boolean', 'symbol',
  'bigint', 'object', 'readonly', 'keyof', 'typeof', 'infer',
  'extends', 'implements', 'abstract', 'private', 'protected',
  'public', 'static', 'readonly', 'declare', 'module', 'namespace',
  'enum', 'const', 'let', 'var', 'function', 'class', 'import',
  'export', 'from', 'of', 'as', 'satisfies',
]);

export function extractTypeScriptSymbols(
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  // First run the JS extractor for common constructs
  extractJavaScriptSymbols(line, lineIdx, callback);

  const trimmed = line.trimStart();

  // ── Interface declarations ────────────────────────────────────────
  let m = trimmed.match(
    /^(?:export\s+(?:default\s+)?)?(?:declare\s+)?interface\s+([a-zA-Z_$]\w*)/
  );
  if (m) {
    callback({ name: m[1], kind: 'interface', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Type alias ─────────────────────────────────────────────────────
  m = trimmed.match(
    /^(?:export\s+(?:default\s+)?)?type\s+([a-zA-Z_$]\w*)\s*=\s*/
  );
  if (m) {
    callback({ name: m[1], kind: 'interface', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Enum declarations ─────────────────────────────────────────────
  m = trimmed.match(
    /^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:const\s+)?enum\s+([a-zA-Z_$]\w*)/
  );
  if (m) {
    callback({ name: m[1], kind: 'enum', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Namespace / Module ─────────────────────────────────────────────
  m = trimmed.match(
    /^(?:declare\s+)?(?:namespace|module)\s+([a-zA-Z_$]\w*(?:\.[a-zA-Z_$]\w*)*)/
  );
  if (m) {
    callback({ name: m[1], kind: 'namespace', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Abstract class ─────────────────────────────────────────────────
  m = trimmed.match(
    /^(?:export\s+(?:default\s+)?)?abstract\s+class\s+([a-zA-Z_$]\w*)/
  );
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Generic type parameter: <T, U extends ...> ───────────────────
  // Extract from type/interface/class definitions
  m = trimmed.match(/^(?:export\s+)?(?:type|interface|class)\s+[a-zA-Z_$]\w*\s*<([a-zA-Z_$]\w*(?:\s*,\s*[a-zA-Z_$]\w*)*)>/);
  if (m) {
    const params = m[1].split(',').map(p => p.trim());
    for (const param of params) {
      const name = param.split(/\s+/)[0]; // Handle "T extends Foo"
      if (name && /^[a-zA-Z_$]\w*$/.test(name) && !TS_KEYWORDS.has(name)) {
        callback({ name, kind: 'parameter', line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
      }
    }
    return;
  }

  // ── Decorator (skip, but extract the decorator name) ──────────────
  m = trimmed.match(/^@([a-zA-Z_$]\w*)/);
  if (m) {
    // Decorators are not symbols themselves but could be referenced
    // Skip for now to avoid polluting suggestions
    return;
  }
}
