/**
 * JavaScript language extractor.
 *
 * Collects:
 *   class, function, method, parameter, loopVariable,
 *   catchVariable, variable, constant (UPPER_CASE).
 *
 * Handles:
 *   - Function declarations
 *   - Arrow functions (const x = (params) =>)
 *   - Async functions
 *   - Destructuring (const { a, b } = obj)
 *   - for, for...of, for...in loop variables
 */

import type { DocumentSymbol, SymbolKind } from '../DocumentSymbol';

const KEYWORDS = new Set([
  'abstract', 'arguments', 'async', 'await', 'boolean', 'break', 'byte',
  'case', 'catch', 'char', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'double', 'else', 'enum', 'eval', 'export',
  'extends', 'false', 'final', 'finally', 'float', 'for', 'function',
  'goto', 'if', 'implements', 'import', 'in', 'instanceof', 'int',
  'interface', 'let', 'long', 'native', 'new', 'null', 'of', 'package',
  'private', 'protected', 'public', 'return', 'short', 'static', 'super',
  'switch', 'synchronized', 'this', 'throw', 'throws', 'transient',
  'true', 'try', 'typeof', 'undefined', 'var', 'void', 'volatile',
  'while', 'with', 'yield', 'NaN', 'Infinity', 'console', 'window',
  'document', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Symbol', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Error', 'Date', 'RegExp', 'Function', 'Proxy', 'Reflect',
  'globalThis', 'global', 'process', 'Buffer', 'require', 'module',
  'exports', '__dirname', '__filename',
]);

export function extractJavaScriptSymbols(
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const trimmed = line.trimStart();

  // ── Classes ───────────────────────────────────────────────────────
  let m = trimmed.match(/^class\s+([a-zA-Z_$]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Function declarations ─────────────────────────────────────────
  m = trimmed.match(/^(?:async\s+)?function\s+(?:[*]\s*)?([a-zA-Z_$]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'function', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    // Parameters will be extracted from the line
    extractFunctionParams(line, line, lineIdx, callback);
    return;
  }

  // ── Export default functions ───────────────────────────────────────
  m = trimmed.match(/^export\s+(?:default\s+)?(?:async\s+)?function\s+(?:[*]\s*)?([a-zA-Z_$]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'function', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    extractFunctionParams(line, line, lineIdx, callback);
    return;
  }

  // ── Export named class ─────────────────────────────────────────────
  m = trimmed.match(/^export\s+(?:default\s+)?class\s+([a-zA-Z_$]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Arrow functions assigned to variables ─────────────────────────
  // const name = (params) => { ... } or const name = params => { ... }
  m = trimmed.match(/^(?:const|let|var)\s+([a-zA-Z_$]\w*)\s*=\s*(?:async\s+)?\(/);
  if (m && !KEYWORDS.has(m[1])) {
    callback({ name: m[1], kind: 'function', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    // Extract arrow function parameters
    extractArrowFnParams(line, line, lineIdx, callback);
    return;
  }

  // ── Arrow function with single param (no parens): const name = param => ...
  m = trimmed.match(/^(?:const|let|var)\s+([a-zA-Z_$]\w*)\s*=\s*(?:async\s+)?([a-zA-Z_$]\w*)\s*=>/);
  if (m && !KEYWORDS.has(m[1])) {
    // m[1] is the variable name, m[2] is the parameter
    callback({ name: m[1], kind: 'function', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    if (m[2] && !KEYWORDS.has(m[2])) {
      callback({ name: m[2], kind: 'parameter', line: lineIdx, column: line.indexOf(m[2]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[2]) });
    }
    return;
  }

  // ── Method shorthand in objects/classes ───────────────────────────
  // methodName(params) { ... }
  m = trimmed.match(/^([a-zA-Z_$]\w*)\s*\(/);
  if (m && !KEYWORDS.has(m[1]) && !m[1].startsWith('_')) {
    // Only if it looks like a method (not a function call)
    callback({ name: m[1], kind: 'method', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    extractFunctionParams(line, line, lineIdx, callback);
    return;
  }

  // ── Import statements ─────────────────────────────────────────────
  m = trimmed.match(/^(?:import\s+(?:\w+\s+from\s+)?['"]([a-zA-Z_@][^'"]*)['"])/);
  if (m) {
    // Just extract the imported name
    const importMatch = trimmed.match(/^import\s+([a-zA-Z_$]\w*)/);
    if (importMatch) {
      callback({ name: importMatch[1], kind: 'import', line: lineIdx, column: line.indexOf(importMatch[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(importMatch[1]) });
    }
    return;
  }

  // ── For loop variables ────────────────────────────────────────────
  m = trimmed.match(/^for\s*\(?\s*(?:let|const|var)\s+([a-zA-Z_$]\w*)\s*(?:;|of|in)\s*/);
  if (m) {
    callback({ name: m[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── For...of with destructuring: for (const { x } of arr) ─────────
  m = trimmed.match(/^for\s*\(?\s*(?:const|let|var)\s+\{[^}]*\}\s+of\s+/);
  if (m) {
    // Extract destructured names: { a, b, c: d }
    const destrMatch = trimmed.match(/\{\s*([^}]*)\s*}\s+of/);
    if (destrMatch) {
      const names = destrMatch[1].split(',').map(s => s.trim());
      for (const entry of names) {
        // Handle { a } or { a: b }
        const parts = entry.split(':').map(s => s.trim());
        const name = parts[parts.length - 1];
        if (name && /^[a-zA-Z_$]\w*$/.test(name) && !KEYWORDS.has(name)) {
          callback({ name, kind: 'loopVariable', line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
        }
      }
    }
    return;
  }

  // ── Catch variables ───────────────────────────────────────────────
  m = trimmed.match(/^catch\s*\(?\s*([a-zA-Z_$]\w*)\s*\)?/);
  if (m) {
    callback({ name: m[1], kind: 'catchVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Variable declarations: const/let/var ──────────────────────────
  // Single declaration
  m = trimmed.match(/^(?:const|let|var)\s+([a-zA-Z_$]\w*)\s*(?:=\s*|;|$)/);
  if (m && !KEYWORDS.has(m[1])) {
    const name = m[1];
    const kind: SymbolKind = /^[A-Z_][A-Z0-9_]*$/.test(name) ? 'constant' : 'variable';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    return;
  }

  // ── Destructuring: const { a, b } = obj ────────────────────────────
  m = trimmed.match(/^(?:const|let|var)\s+\{\s*([^}]+)\s*}\s*=\s*/);
  if (m) {
    const names = m[1].split(',').map(s => s.trim());
    for (const entry of names) {
      // Handle { a } or { a: b }
      const parts = entry.split(':').map(s => s.trim());
      const name = parts[parts.length - 1];
      if (name && /^[a-zA-Z_$]\w*$/.test(name) && !KEYWORDS.has(name)) {
        callback({ name, kind: 'variable', line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
      }
    }
    return;
  }

  // ── Destructuring array: const [a, b] = arr ────────────────────────
  m = trimmed.match(/^(?:const|let|var)\s+\[\s*([^\]]+)\s*\]\s*=\s*/);
  if (m) {
    const names = m[1].split(',').map(s => s.trim());
    for (const entry of names) {
      const name = entry.replace(/^\.\.\./, '');
      if (name && /^[a-zA-Z_$]\w*$/.test(name) && !KEYWORDS.has(name)) {
        callback({ name, kind: 'variable', line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
      }
    }
    return;
  }

  // ── Simple assignment (fallback) ──────────────────────────────────
  m = trimmed.match(/^(?:(?:let|var|const)\s+)?([a-zA-Z_$]\w*)\s*=(?!=)/);
  if (m && !KEYWORDS.has(m[1]) && m[1] !== 'this') {
    const name = m[1];
    const kind: SymbolKind = /^[A-Z_][A-Z0-9_]*$/.test(name) ? 'constant' : 'variable';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    return;
  }

  // ── Augmented assignment ──────────────────────────────────────────
  m = trimmed.match(/^([a-zA-Z_$]\w*)\s*[+\-*/%&|^]=/);
  if (m && !KEYWORDS.has(m[1]) && m[1] !== 'this') {
    callback({ name: m[1], kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }
}

/** Extract function/method parameters from a function definition line. */
function extractFunctionParams(
  line: string,
  originalLine: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const parenStart = line.indexOf('(');
  if (parenStart === -1) return;
  const closeParen = findMatchingParenJS(line, parenStart);
  if (closeParen === -1) return;
  const paramsStr = line.substring(parenStart + 1, closeParen);
  if (!paramsStr.trim()) return;

  const params = splitParamsJS(paramsStr);
  for (const param of params) {
    const trimmed = param.trim();
    if (!trimmed) continue;

    // Handle destructuring: { a } or [ a ]
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) continue; // skip destructuring for simplicity

    // Handle default values: name = default
    let pName = trimmed.split('=')[0].trim();
    // Handle type annotations (TypeScript): name: Type
    pName = pName.split(':')[0].trim();
    // Handle rest: ...name
    pName = pName.replace(/^\.\.\./, '');

    if (pName && /^[a-zA-Z_$]\w*$/.test(pName) && !KEYWORDS.has(pName)) {
      const pCol = originalLine.indexOf(pName);
      callback({ name: pName, kind: 'parameter', line: lineIdx, column: Math.max(0, pCol), declarationLine: lineIdx, declarationColumn: Math.max(0, pCol) });
    }
  }
}

/** Extract arrow function parameters. */
function extractArrowFnParams(
  line: string,
  originalLine: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) return;
  const afterEq = line.substring(eqIdx + 1);
  const parenStart = afterEq.indexOf('(');
  if (parenStart === -1) return;
  const closeParen = findMatchingParenJS(afterEq, parenStart);
  if (closeParen === -1) return;
  const paramsStr = afterEq.substring(parenStart + 1, closeParen);
  if (!paramsStr.trim()) return;

  const params = paramsStr.split(',').map(p => p.trim());
  for (const param of params) {
    if (!param) continue;
    let pName = param.split('=')[0].trim();
    pName = pName.split(':')[0].trim();
    pName = pName.replace(/^\.\.\./, '');
    if (pName && /^[a-zA-Z_$]\w*$/.test(pName) && !KEYWORDS.has(pName)) {
      const pCol = originalLine.indexOf(pName);
      callback({ name: pName, kind: 'parameter', line: lineIdx, column: Math.max(0, pCol), declarationLine: lineIdx, declarationColumn: Math.max(0, pCol) });
    }
  }
}

function findMatchingParenJS(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split JS parameter list by commas, respecting nested parens/brackets. */
function splitParamsJS(str: string): string[] {
  const parts: string[] = [];
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}
