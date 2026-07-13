/**
 * C++ language extractor.
 *
 * Collects:
 *   class, struct, enum, namespace, function, method,
 *   parameter, loopVariable, catchVariable, field,
 *   staticField, variable, constant (UPPER_CASE).
 */

import type { DocumentSymbol, SymbolKind } from '../DocumentSymbol';

const KEYWORDS = new Set([
  'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const',
  'constexpr', 'continue', 'decltype', 'default', 'delete', 'do',
  'double', 'else', 'enum', 'explicit', 'export', 'extern', 'float',
  'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable',
  'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'override',
  'private', 'protected', 'public', 'register', 'return', 'short',
  'signed', 'sizeof', 'static', 'static_cast', 'struct', 'switch',
  'template', 'this', 'throw', 'try', 'typedef', 'typeid',
  'typename', 'union', 'unsigned', 'using', 'virtual', 'void',
  'volatile', 'while', 'include', 'define', 'ifdef', 'ifndef',
  'endif', 'pragma', 'true', 'false', 'nullptr_t', 'string',
  'vector', 'map', 'set', 'list', 'array', 'pair', 'cin', 'cout',
  'endl', 'iterator', 'size_t', 'int8_t', 'int16_t', 'int32_t',
  'int64_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
]);

export function extractCppSymbols(
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const trimmed = line.trimStart();

  // ── Namespace ─────────────────────────────────────────────────────
  let m = trimmed.match(/^namespace\s+([a-zA-Z_]\w*)\s*(?:\{|$)/);
  if (m) {
    callback({ name: m[1], kind: 'namespace', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Classes ───────────────────────────────────────────────────────
  m = trimmed.match(
    /^((?:class|struct)\s+)([a-zA-Z_]\w*)\s*(?::\s*(?:public|private|protected)\s+[a-zA-Z_]\w*\s*)?(?:\{|$)/
  );
  if (m) {
    const kind: SymbolKind = trimmed.startsWith('struct') ? 'struct' : 'class';
    callback({ name: m[2], kind, line: lineIdx, column: line.indexOf(m[2]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[2]) });
    return;
  }

  // ── Enum ──────────────────────────────────────────────────────────
  m = trimmed.match(/^enum\s+(?:class\s+)?([a-zA-Z_]\w*)\s*(?:\{|$)/);
  if (m) {
    callback({ name: m[1], kind: 'enum', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Functions / Methods ───────────────────────────────────────────
  // Matches: return_type funcName(params) { or return_type funcName(params);
  // Must not match keywords, destructors (~Name), or operator overloads
  m = trimmed.match(
    /^(?:virtual\s+|static\s+|inline\s+|constexpr\s+|explicit\s+)*(?:[a-zA-Z_]\w*(?:\s*[*&])?\s+)+([a-zA-Z_]\w*)\s*\(/
  );
  if (m && !m[1].startsWith('~') && m[1] !== 'operator') {
    const name = m[1];
    // Check if it looks like a constructor (same name as class? we can't check here reliably)
    const kind: SymbolKind = 'function';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });

    // Extract parameters
    const parenStart = line.indexOf('(', line.indexOf(name));
    if (parenStart !== -1) {
      const closeParen = findMatchingParen(line, parenStart);
      if (closeParen !== -1) {
        const paramsStr = line.substring(parenStart + 1, closeParen);
        extractCppParameters(paramsStr, line, lineIdx, callback);
      }
    }
    return;
  }

  // ── For loop variables ────────────────────────────────────────────
  m = trimmed.match(/^for\s*\(?\s*(?:\w+(?:\s+[*&])?)\s+([a-zA-Z_]\w*)\s*(?:=|:)/);
  if (m) {
    callback({ name: m[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Range-based for: for (auto x : ...) ───────────────────────────
  m = trimmed.match(/^for\s*\(?\s*(?:\w+\s+)+([a-zA-Z_]\w*)\s*:/);
  if (m) {
    callback({ name: m[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Catch variables ───────────────────────────────────────────────
  m = trimmed.match(/^catch\s*\((?:\w+(?:\s+[*&])?)\s+([a-zA-Z_]\w*)\s*\)/);
  if (m) {
    callback({ name: m[1], kind: 'catchVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Variable declarations (with type) ─────────────────────────────
  // Matches: type varName = ...; or type varName;
  // Skip if it starts with known control flow keywords
  if (!/^\s*(?:if|while|for|switch|return|catch|throw)\b/.test(line)) {
    m = trimmed.match(
      /^(?:(?:const|static|mutable|volatile|register|unsigned|signed|long|short|double|float|char|int|bool|void|auto|size_t|string|vector|map|set|list|array|pair|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|[a-zA-Z_]\w*_t)\s+[*&]?\s*)+([a-zA-Z_]\w*)\s*(?:=\s*[^;]+\s*)?(?:,|;)/
    );
    if (m && !KEYWORDS.has(m[1]) && !m[1].startsWith('_')) {
      const name = m[1];
      const isConst = line.includes('const ');
      const kind: SymbolKind = isConst ? 'constant' : 'variable';
      callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
      return;
    }

    // ── Static field ──────────────────────────────────────────────────
    m = trimmed.match(/^static\s+(?:\w+\s+)+([a-zA-Z_]\w*)\s*(?:;|=)/);
    if (m && !KEYWORDS.has(m[1])) {
      callback({ name: m[1], kind: 'staticField', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
      return;
    }
  }

  // ── Simple assignment (fallback for untyped variables) ────────────
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

/** Find matching closing paren, handling nested parens. */
function findMatchingParen(str: string, openIdx: number): number {
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

/** Extract parameter names from a C++ parameter list string. */
function extractCppParameters(
  paramsStr: string,
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  if (!paramsStr || paramsStr.trim() === 'void') return;

  // Split by commas, respecting template nesting
  const params = splitParamsRespectingTemplates(paramsStr);
  for (const param of params) {
    const trimmed = param.trim();
    if (!trimmed || trimmed === 'void') continue;

    // Handle: type name, type& name, type* name, type name = default
    // Also: const type& name, type&& name
    let pName = '';

    // Try to extract the name (last identifier before = or end)
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      // Look for the actual parameter name
      for (let i = parts.length - 1; i >= 0; i--) {
        const candidate = parts[i].replace(/[*&]/g, '');
        if (/^[a-zA-Z_]\w*$/.test(candidate) && !KEYWORDS.has(candidate) &&
            candidate !== 'const' && candidate !== 'volatile' && candidate !== 'unsigned' &&
            candidate !== 'signed' && candidate !== 'long' && candidate !== 'short' &&
            candidate !== 'auto' && !candidate.includes('>') && !candidate.includes('<')) {
          pName = candidate;
          break;
        }
      }
    }

    if (pName && !KEYWORDS.has(pName)) {
      const pCol = line.indexOf(pName);
      callback({ name: pName, kind: 'parameter', line: lineIdx, column: Math.max(0, pCol), declarationLine: lineIdx, declarationColumn: Math.max(0, pCol) });
    }
  }
}

/** Split a C++ parameter list by commas, respecting <> template nesting. */
function splitParamsRespectingTemplates(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '<') depth++;
    else if (ch === '>') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}
