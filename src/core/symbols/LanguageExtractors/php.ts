/**
 * PHP language extractor.
 *
 * Collects:
 *   class, interface, function, method, parameter,
 *   loopVariable, catchVariable, variable (prefixed with $),
 *   field ($this->x), constant (define, const).
 */

import type { DocumentSymbol, SymbolKind } from '../DocumentSymbol';

const KEYWORDS = new Set([
  '__CLASS__', '__DIR__', '__FILE__', '__FUNCTION__', '__LINE__',
  '__METHOD__', '__NAMESPACE__', '__TRAIT__', 'abstract', 'and',
  'array', 'as', 'break', 'callable', 'case', 'catch', 'class',
  'clone', 'const', 'continue', 'declare', 'default', 'die', 'do',
  'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor',
  'endforeach', 'endif', 'endswitch', 'endwhile', 'eval', 'exit',
  'extends', 'final', 'finally', 'fn', 'for', 'foreach', 'function',
  'global', 'goto', 'if', 'implements', 'include', 'include_once',
  'instanceof', 'insteadof', 'interface', 'isset', 'list', 'match',
  'namespace', 'new', 'or', 'print', 'private', 'protected', 'public',
  'readonly', 'require', 'require_once', 'return', 'static', 'switch',
  'throw', 'trait', 'try', 'unset', 'use', 'var', 'while', 'xor',
  'yield', 'true', 'false', 'null', 'void', 'int', 'float', 'string',
  'bool', 'array', 'object', 'mixed', 'never', 'iterable', 'self',
  'parent', 'this',
]);

export function extractPhpSymbols(
  line: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const trimmed = line.trimStart();

  // ── Namespace ─────────────────────────────────────────────────────
  let m = trimmed.match(/^namespace\s+([a-zA-Z_\\]\w*(?:\\[a-zA-Z_]\w*)*)\s*(?:;|$)/);
  if (m) {
    callback({ name: m[1], kind: 'namespace', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Use/Import ────────────────────────────────────────────────────
  m = trimmed.match(/^use\s+(?:function\s+|const\s+)?([a-zA-Z_\\]\w*(?:\\[a-zA-Z_]\w*)*)/);
  if (m) {
    const parts = m[1].split('\\');
    const name = parts[parts.length - 1];
    if (name && /^[a-zA-Z_]\w*$/.test(name)) {
      callback({ name, kind: 'import', line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    }
    return;
  }

  // ── Classes ───────────────────────────────────────────────────────
  m = trimmed.match(
    /^(?:(?:abstract|final|readonly)\s+)?class\s+([a-zA-Z_]\w*)/i
  );
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Interfaces ────────────────────────────────────────────────────
  m = trimmed.match(/^interface\s+([a-zA-Z_]\w*)/i);
  if (m) {
    callback({ name: m[1], kind: 'interface', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Traits ────────────────────────────────────────────────────────
  m = trimmed.match(/^trait\s+([a-zA-Z_]\w*)/i);
  if (m) {
    callback({ name: m[1], kind: 'class', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Enums (PHP 8.1+) ──────────────────────────────────────────────
  m = trimmed.match(/^enum\s+([a-zA-Z_]\w*)/i);
  if (m) {
    callback({ name: m[1], kind: 'enum', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Functions ─────────────────────────────────────────────────────
  m = trimmed.match(/^(?:function\s+)([a-zA-Z_]\w*)\s*\(/i);
  if (m) {
    callback({ name: m[1], kind: 'function', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    // Extract parameters
    extractPhpFunctionParams(line, line, lineIdx, callback);
    return;
  }

  // ── Methods (inside classes) ──────────────────────────────────────
  m = trimmed.match(
    /^(?:(?:(?:public|private|protected)\s+)*(?:static\s+)?(?:function\s+))([a-zA-Z_]\w*)\s*\(/i
  );
  if (m) {
    const name = m[1];
    const kind: SymbolKind = (name === '__construct' || name === '__destruct') ? 'constructor' : 'method';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    extractPhpFunctionParams(line, line, lineIdx, callback);
    return;
  }

  // ── Arrow functions (PHP 7.4+): fn($x) => ... ─────────────────────
  m = trimmed.match(/^(?:(?:static\s+)?fn\s+\([^)]*\)\s*=>)/);
  if (m) {
    // Extract parameter names
    const arrowParen = trimmed.match(/^fn\s*\(([^)]*)\)/i);
    if (arrowParen) {
      const params = arrowParen[1].split(',').map(p => p.trim());
      for (const param of params) {
        const pName = param.replace(/^\$/, '').split(':')[0].trim();
        if (pName && /^[a-zA-Z_]\w*$/.test(pName) && !KEYWORDS.has(pName)) {
          callback({ name: pName, kind: 'parameter', line: lineIdx, column: line.indexOf(pName), declarationLine: lineIdx, declarationColumn: line.indexOf(pName) });
        }
      }
    }
    return;
  }

  // ── For/foreach loop variables ────────────────────────────────────
  m = trimmed.match(/^for\s*\(?\s*(?:\$[a-zA-Z_]\w*\s*=\s*[^;]+;\s*)?\$?([a-zA-Z_]\w*)/);
  if (m && trimmed.startsWith('for')) {
    // Extract the loop variable
    const forVar = trimmed.match(/(?:\$?([a-zA-Z_]\w*))\s*(?:;|:)/);
    if (forVar) {
      callback({ name: forVar[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(forVar[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(forVar[1]) });
    }
    return;
  }

  // ── Foreach: foreach ($arr as $key => $value) ─────────────────────
  m = trimmed.match(/^foreach\s*\([^)]+as\s+\$?([a-zA-Z_]\w*)/i);
  if (m) {
    callback({ name: m[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    // Also extract value variable if exists: as $key => $value
    const valMatch = trimmed.match(/as\s+\$?\w+\s*=>\s*\$?([a-zA-Z_]\w*)/i);
    if (valMatch) {
      callback({ name: valMatch[1], kind: 'loopVariable', line: lineIdx, column: line.indexOf(valMatch[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(valMatch[1]) });
    }
    return;
  }

  // ── Catch variables ───────────────────────────────────────────────
  m = trimmed.match(/^catch\s*\((?:\w+\s+)?\$?([a-zA-Z_]\w*)/i);
  if (m) {
    callback({ name: m[1], kind: 'catchVariable', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Constants: define('NAME', value) ──────────────────────────────
  m = trimmed.match(/^define\s*\(\s*['"]([a-zA-Z_]\w*)['"]/i);
  if (m) {
    callback({ name: m[1], kind: 'constant', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Class constants: const NAME = value ───────────────────────────
  m = trimmed.match(/^(?:(?:public|private|protected)\s+)?const\s+([a-zA-Z_]\w*)/i);
  if (m) {
    callback({ name: m[1], kind: 'constant', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Instance fields: $this->field ─────────────────────────────────
  m = trimmed.match(/\$this->([a-zA-Z_]\w*)/);
  if (m) {
    callback({ name: m[1], kind: 'field', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }

  // ── Variable assignments: $var = ... ──────────────────────────────
  m = trimmed.match(/^\$([a-zA-Z_]\w*)\s*(?:::)?=(?!=)/);
  if (m && !KEYWORDS.has(m[1])) {
    // Check context: inside class → field, otherwise variable
    const name = m[1];
    const kind: SymbolKind = /^[A-Z_][A-Z0-9_]*$/.test(name) ? 'constant' : 'variable';
    callback({ name, kind, line: lineIdx, column: line.indexOf(name), declarationLine: lineIdx, declarationColumn: line.indexOf(name) });
    return;
  }

  // ── Static property: Class::$var ──────────────────────────────────
  m = trimmed.match(/::\s*\$([a-zA-Z_]\w*)\s*=/);
  if (m) {
    callback({ name: m[1], kind: 'staticField', line: lineIdx, column: line.indexOf(m[1]), declarationLine: lineIdx, declarationColumn: line.indexOf(m[1]) });
    return;
  }
}

/** Extract parameters from a PHP function/method definition. */
function extractPhpFunctionParams(
  line: string,
  originalLine: string,
  lineIdx: number,
  callback: (sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>) => void,
): void {
  const parenStart = line.indexOf('(');
  if (parenStart === -1) return;
  const closeParen = findMatchingParenPhp(line, parenStart);
  if (closeParen === -1) return;
  const paramsStr = line.substring(parenStart + 1, closeParen);
  if (!paramsStr.trim()) return;

  const params = paramsStr.split(',').map(p => p.trim());
  for (const param of params) {
    if (!param) continue;
    // Handle: Type $name = default, #[\Attr] Type $name
    let pName = param;
    // Remove attributes #[...]
    pName = pName.replace(/#\[[^\]]*\]/g, '').trim();
    // Remove leading type hint (string, int, array, etc.)
    const parts = pName.split(/\s+/);
    let lastName = '';
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = parts[i];
      if (candidate.startsWith('$')) {
        lastName = candidate;
        break;
      }
    }
    if (lastName) {
      // Remove $ prefix
      const cleanName = lastName.replace(/^\$/, '');
      // Handle default value
      const defaultSplit = cleanName.split('=')[0].trim();
      if (defaultSplit && /^[a-zA-Z_]\w*$/.test(defaultSplit) && !KEYWORDS.has(defaultSplit)) {
        const pCol = originalLine.indexOf(defaultSplit);
        callback({ name: defaultSplit, kind: 'parameter', line: lineIdx, column: Math.max(0, pCol), declarationLine: lineIdx, declarationColumn: Math.max(0, pCol) });
      }
    }
  }
}

function findMatchingParenPhp(str: string, openIdx: number): number {
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
