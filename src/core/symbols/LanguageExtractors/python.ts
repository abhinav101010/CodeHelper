/**
 * Python language extractor.
 *
 * Collects:
 *   class, function/method, parameter, variable, loopVariable,
 *   constant (UPPER_CASE), field (self.x), import
 */

import type { DocumentSymbol, SymbolKind } from '../DocumentSymbol';

const KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'try', 'while', 'with', 'yield',
]);

export function extractPythonSymbols(
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const trimmed = line.trimStart();

  // ── Classes ───────────────────────────────────────────────────────
  let m = trimmed.match(/^class\s+([a-zA-Z_]\w*)\s*(?:\(|:)/);
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return; // class def done for this line
  }

  // ── Functions / Methods ───────────────────────────────────────────
  m = trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/);
  if (m) {
    const kind: SymbolKind = line.trimStart().startsWith('def ') ? 'function' : 'function';
    const column = line.indexOf(m[1]);
    callback({ name: m[1], kind, line: lineIdx, column, declarationLine: lineIdx, declarationColumn: column });

    // Extract parameters from the signature
    const paramsStr = line.substring(line.indexOf('(') + 1, line.lastIndexOf(')'));
    if (paramsStr) {
      const params = paramsStr.split(',').map(p => p.trim());
      for (const param of params) {
        // Handle default values: `param=value`
        const pName = param.split('=')[0].trim();
        // Handle type annotations: `param: type` or `*args` / `**kwargs`
        const cleanName = pName.split(':')[0].trim().replace(/^(\*+)/, '');
        if (cleanName && /^[a-zA-Z_]\w*$/.test(cleanName) && !KEYWORDS.has(cleanName)) {
          const pCol = line.indexOf(cleanName);
          callback({ name: cleanName, kind: 'parameter', line: lineIdx, column: Math.max(0, pCol), declarationLine: lineIdx, declarationColumn: Math.max(0, pCol) });
        }
      }
    }
    return;
  }

  // ── Import statements ─────────────────────────────────────────────
  m = trimmed.match(/^(?:import|from)\s+([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)/);
  if (m) {
    callback({ name: m[1], kind: 'import', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── For loop variables ────────────────────────────────────────────
  m = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+/);
  if (m) {
    callback({ name: m[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── For loop tuple unpacking: for a, b in ... ─────────────────────
  m = trimmed.match(/^for\s+\(?\s*([a-zA-Z_]\w*)\s*,/);
  if (m) {
    callback({ name: m[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    // Try to get second variable
    const rest = trimmed.substring(trimmed.indexOf(',') + 1);
    const m2 = rest.match(/\s*([a-zA-Z_]\w*)\s*(?:,|\))?\s+in\s+/);
    if (m2) {
      callback({ name: m2[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m2[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m2[1]) });
    }
    return;
  }

  // ── Except ... as e ───────────────────────────────────────────────
  m = trimmed.match(/^except\s+(?:\w+\s+)?as\s+([a-zA-Z_]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'catchVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── With ... as x ─────────────────────────────────────────────────
  m = trimmed.match(/^with\s+.*?\s+as\s+([a-zA-Z_]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Instance fields: self.x = ... ─────────────────────────────────
  m = trimmed.match(/self\.([a-zA-Z_]\w*)\s*=/);
  if (m) {
    callback({ name: m[1], kind: 'field', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Instance fields at class level via annotation ─────────────────
  m = trimmed.match(/^\s*([a-zA-Z_]\w*)\s*:\s*(?:\w+\s*)?=\s*/);
  if (!m) {
    m = trimmed.match(/^\s*([a-zA-Z_]\w*)\s*:\s*\w+/);
  }
  if (m && !KEYWORDS.has(m[1]) && !m[1].startsWith('_')) {
    // Check if it's a typed variable declaration at class/global scope
    callback({ name: m[1], kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Simple assignment: x = ... ────────────────────────────────────
  // Only match if it looks like a fresh declaration
  m = trimmed.match(/^([a-zA-Z_]\w*)\s*=(?!=)/);
  if (m && !KEYWORDS.has(m[1])) {
    const name = m[1];
    // Check if it's a constant (UPPER_CASE)
    const kind: SymbolKind = /^[A-Z_][A-Z0-9_]*$/.test(name) ? 'constant' : 'variable';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    return;
  }

  // ── Augmented assignment: x += ... (already declared likely, but index it) ──
  m = trimmed.match(/^([a-zA-Z_]\w*)\s*[+\-*/%&|^]=/);
  if (m && !KEYWORDS.has(m[1])) {
    callback({ name: m[1], kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Lambda parameter: lambda x, y: ... ────────────────────────────
  m = trimmed.match(/^lambda\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s*:/);
  if (m) {
    const params = m[1].split(',').map(p => p.trim());
    for (const p of params) {
      if (p && !KEYWORDS.has(p)) {
        callback({ name: p, kind: 'parameter', line: lineIdx, column: line.indexOf(p), declarationLine: lineIdx, declarationColumn: line.indexOf(p) });
      }
    }
    return;
  }
}
