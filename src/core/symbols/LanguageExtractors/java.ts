/**
 * Java language extractor.
 *
 * Collects:
 *   class, interface, enum, method, constructor,
 *   parameter, loopVariable, catchVariable, field,
 *   staticField, variable, constant.
 */

import type { DocumentSymbol, SymbolKind } from '../DocumentSymbol';

const KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
  'char', 'class', 'const', 'continue', 'default', 'do', 'double',
  'else', 'enum', 'extends', 'final', 'finally', 'float', 'for',
  'goto', 'if', 'implements', 'import', 'instanceof', 'int',
  'interface', 'long', 'native', 'new', 'package', 'private',
  'protected', 'public', 'return', 'short', 'static', 'strictfp',
  'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while', 'true', 'false',
  'null', 'var', 'String', 'Integer', 'Boolean', 'Double', 'Float',
  'Long', 'Short', 'Byte', 'Char', 'Object', 'List', 'Map', 'Set',
  'ArrayList', 'HashMap', 'HashSet', 'LinkedList', 'Optional',
  'Arrays', 'Collections', 'System',
]);

export function extractJavaSymbols(
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const trimmed = line.trimStart();

  // ── Package declaration (skip name) ──────────────────────────────
  if (trimmed.startsWith('package ')) return;

  // ── Import statements ─────────────────────────────────────────────
  let m = trimmed.match(/^import\s+(?:static\s+)?([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)/);
  if (m) {
    callback({ name: m[1], kind: 'import', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Interfaces ────────────────────────────────────────────────────
  m = trimmed.match(/^(?:public\s+|private\s+|protected\s+|abstract\s+)*interface\s+([a-zA-Z_]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'interface', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Enums ─────────────────────────────────────────────────────────
  m = trimmed.match(/^(?:public\s+|private\s+|protected\s+)*enum\s+([a-zA-Z_]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'enum', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Classes ───────────────────────────────────────────────────────
  m = trimmed.match(/^(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+)*class\s+([a-zA-Z_]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Annotation processing ─────────────────────────────────────────
  // Skip @Override, @Deprecated, etc.
  if (trimmed.startsWith('@')) return;

  // ── Methods / Constructors ────────────────────────────────────────
  // Match: [access] [static] [final] [abstract] [synchronized] returnType methodName(params) [throws ...]
  // or: [access] ClassName(params) [throws ...] (constructor)
  m = trimmed.match(
    /^(?:(?:public|private|protected|static|final|abstract|synchronized|native)\s+)*(?:[a-zA-Z_]\w*(?:\[\])?\s+)+([a-zA-Z_]\w*)\s*\(/
  );
  if (m && !KEYWORDS.has(m[1])) {
    const name = m[1];
    const kind: SymbolKind = 'method';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });

    // Extract parameters
    const parenStart = line.indexOf('(', line.indexOf(name));
    if (parenStart !== -1) {
      const closeParen = findMatchingParenJava(line, parenStart);
      if (closeParen !== -1) {
        const paramsStr = line.substring(parenStart + 1, closeParen);
        extractJavaParameters(paramsStr, line, lineIdx, callback);
      }
    }
    return;
  }

  // ── Constructor (class name as method) ─────────────────────────────
  // Handled above by the generic method regex, since constructors
  // are just methods whose name matches the class.

  // ── For loop variables ────────────────────────────────────────────
  m = trimmed.match(/^for\s*\(?\s*(?:\w+(?:\[\])?\s+)?([a-zA-Z_]\w*)\s*(?::\s|;|=)/);
  if (m) {
    callback({ name: m[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Enhanced for: for (Type var : iterable) ───────────────────────
  m = trimmed.match(/^for\s*\(?\s*(?:\w+(?:\[\])?\s+)([a-zA-Z_]\w*)\s*:/);
  if (m) {
    callback({ name: m[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Catch variables ───────────────────────────────────────────────
  m = trimmed.match(/^catch\s*\((?:\w+(?:\[\])?\s+)([a-zA-Z_]\w*)\s*\)/);
  if (m) {
    callback({ name: m[1], kind: 'catchVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Field declarations ────────────────────────────────────────────
  // [access] [static] [final] Type name [= value];
  m = trimmed.match(
    /^(?:(?:public|private|protected)\s+)*(static\s+)?(?:final\s+)?(?:\w+(?:\[\])?\s+)+([a-zA-Z_]\w*)\s*(?:=|;|$)/
  );
  if (m && !KEYWORDS.has(m[2]) && m[2] !== 'class') {
    const name = m[2];
    const isStatic = !!m[1];
    const isFinal = line.includes('final ');
    const kind: SymbolKind = isStatic ? 'staticField' : isFinal ? 'constant' : 'field';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    return;
  }

  // ── Local variable declarations (inside methods) ──────────────────
  m = trimmed.match(/^(?:\w+(?:\[\])?\s+)+([a-zA-Z_]\w*)\s*=\s*/);
  if (m && !KEYWORDS.has(m[1])) {
    const name = m[1];
    const kind: SymbolKind = /^[A-Z_][A-Z0-9_]*$/.test(name) ? 'constant' : 'variable';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    return;
  }

  // ── Simple assignment ─────────────────────────────────────────────
  m = trimmed.match(/^([a-zA-Z_]\w*)\s*=(?!=)/);
  if (m && !KEYWORDS.has(m[1])) {
    const name = m[1];
    const kind: SymbolKind = /^[A-Z_][A-Z0-9_]*$/.test(name) ? 'constant' : 'variable';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    return;
  }

  // ── Augmented assignment ──────────────────────────────────────────
  m = trimmed.match(/^([a-zA-Z_]\w*)\s*[+\-*/%&|^]=/);
  if (m && !KEYWORDS.has(m[1])) {
    callback({ name: m[1], kind: 'variable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }
}

/** Find matching closing paren. */
function findMatchingParenJava(str: string, openIdx: number): number {
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

/** Extract parameter names from a Java parameter list. */
function extractJavaParameters(
  paramsStr: string,
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  if (!paramsStr || paramsStr.trim().length === 0) return;

  const params = paramsStr.split(',').map(p => p.trim());
  for (const param of params) {
    if (!param) continue;

    // Handle: Type name, Type[] name, Type... name
    const parts = param.split(/\s+/);
    if (parts.length >= 2) {
      // Last part is the parameter name (possibly with [] or ... suffix)
      let pName = parts[parts.length - 1].replace(/\[\]$/, '').replace(/\.\.\.$/, '');
      if (/^[a-zA-Z_]\w*$/.test(pName) && !KEYWORDS.has(pName) &&
          !['final', 'static', 'public', 'private', 'protected', 'synchronized', 'volatile', 'transient', 'native', 'strictfp', 'abstract'].includes(pName)) {
        const pCol = line.indexOf(pName);
        callback({ name: pName, kind: 'parameter', line: lineIdx, column: Math.max(0, pCol), declarationLine: lineIdx, declarationColumn: Math.max(0, pCol) });
      }
    }
  }
}
