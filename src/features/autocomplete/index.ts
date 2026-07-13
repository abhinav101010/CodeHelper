/**
 * IdentifierIndex
 *
 * ════════════════════════════════════════════════════════════════════
 * ⚠  DEPRECATED — Replaced by DocumentSymbolIndexer
 * ════════════════════════════════════════════════════════════════════
 *
 * This module has been replaced by the Document Symbol Index
 * in src/core/symbols/.
 *
 * The new system provides:
 *   - Language-specific extractors (Python, C++, Java, JS, etc.)
 *   - Scope-aware ranking
 *   - Symbol kind priority
 *   - Consistent naming (SymbolKind, DocumentSymbol, etc.)
 *   - Future support for Rename, Go to Definition, etc.
 *
 * Kept only for reference. Do not import from this module.
 * Use DocumentSymbolIndexer from src/core/symbols/ instead.
 * ════════════════════════════════════════════════════════════════════
 *
 * Original description below:
 *
 * Lightweight, offline, language-aware identifier index that parses
 * editor content and builds an in-memory symbol index.
 *
 * Supports variables, functions, classes, parameters, and loop variables
 * across Python, C, C++, Java, JavaScript, TypeScript, Go, Rust, and more.
 *
 * NEVER generates code or algorithms — only suggests identifiers that
 * already exist in the user's code.
 */

export interface IdentifierSymbol {
  name: string;
  type: 'variable' | 'function' | 'class' | 'parameter' | 'loop_variable' | 'object_field';
  scope: 'global' | 'function' | 'class' | 'local';
  scopeName: string;
  line: number;
  usageCount: number;
}

export interface IdentifierMatch {
  symbol: IdentifierSymbol;
  /** How the match relates to the prefix */
  matchType: 'exact' | 'prefix' | 'fuzzy';
}

/**
 * Language-specific regex patterns for extracting identifiers.
 * Each language gets patterns for variables, functions, classes,
 * parameters, and loop variables.
 */
interface LangPatterns {
  variable: RegExp;
  function: RegExp;
  class: RegExp;
  parameter: RegExp;
  loopVar: RegExp;
}

const PYTHON_KEYWORDS = new Set([
  'if', 'else', 'elif', 'for', 'while', 'in', 'not', 'and', 'or', 'is',
  'True', 'False', 'None', 'return', 'def', 'class', 'import', 'from',
  'as', 'try', 'except', 'finally', 'with', 'yield', 'lambda', 'pass',
  'break', 'continue', 'raise', 'assert', 'del', 'global', 'nonlocal',
  'print', 'range', 'len', 'int', 'str', 'float', 'list', 'dict',
  'set', 'tuple', 'bool', 'type', 'super', 'self', 'async', 'await',
]);

const JS_TS_KEYWORDS = new Set([
  'let', 'var', 'const', 'if', 'else', 'for', 'while', 'return',
  'function', 'class', 'import', 'export', 'default', 'new', 'this',
  'super', 'try', 'catch', 'finally', 'throw', 'break', 'continue',
  'typeof', 'instanceof', 'void', 'delete', 'switch', 'case', 'do',
  'in', 'of', 'async', 'await', 'yield', 'true', 'false', 'null',
  'undefined', 'interface', 'type', 'enum', 'extends', 'implements',
  'private', 'public', 'protected', 'static', 'readonly', 'abstract',
  'Number', 'String', 'Boolean', 'Object', 'Array', 'Promise',
  'console', 'Math', 'Date', 'RegExp', 'Map', 'Set', 'Error',
  'Symbol', 'BigInt',
]);

const CPP_KEYWORDS = new Set([
  'int', 'long', 'float', 'double', 'char', 'bool', 'void', 'auto',
  'const', 'static', 'extern', 'volatile', 'register', 'signed',
  'unsigned', 'short', 'virtual', 'explicit', 'friend', 'inline',
  'override', 'final', 'using', 'namespace', 'class', 'struct',
  'union', 'enum', 'typedef', 'template', 'typename', 'public',
  'private', 'protected', 'this', 'true', 'false', 'nullptr',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'goto', 'try', 'catch', 'throw',
  'new', 'delete', 'sizeof', 'typedef', 'constexpr', 'const_cast',
  'static_cast', 'dynamic_cast', 'reinterpret_cast',
  'std', 'vector', 'map', 'set', 'string', 'pair', 'queue', 'stack',
  'deque', 'unordered_map', 'unordered_set', 'priority_queue',
  'list', 'array', 'sort', 'reverse', 'binary_search', 'lower_bound',
  'upper_bound', 'accumulate', 'count', 'find', 'begin', 'end',
  'size', 'push_back', 'pop_back', 'push_front', 'pop_front',
  'first', 'second', 'make_pair', 'emplace_back',
  'cin', 'cout', 'endl', 'printf', 'scanf', 'NULL',
  'INT_MAX', 'INT_MIN', 'LONG_MAX', 'LONG_MIN', 'LLONG_MAX',
  'll', 'long long',
]);

const JAVA_KEYWORDS = new Set([
  'int', 'long', 'float', 'double', 'char', 'boolean', 'byte',
  'short', 'void', 'String', 'Integer', 'Long', 'Double', 'Boolean',
  'Character', 'Byte', 'Short', 'Float', 'Object', 'Class',
  'null', 'true', 'false', 'this', 'super', 'new', 'return',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws',
  'public', 'private', 'protected', 'static', 'final', 'abstract',
  'class', 'interface', 'enum', 'extends', 'implements', 'package',
  'import', 'synchronized', 'volatile', 'transient', 'native',
  'strictfp', 'instanceof', 'assert', 'System', 'Math', 'Arrays',
  'List', 'ArrayList', 'Map', 'HashMap', 'Set', 'HashSet',
  'Queue', 'LinkedList', 'Stack', 'PriorityQueue',
  'Deque', 'ArrayDeque', 'Collections', 'Comparator',
  'Optional', 'Stream', 'Collectors', 'Integer', 'StringBuilder',
  'StringBuffer', 'print', 'println', 'printf',
  'List<int>', 'List<String>',
]);

const GO_KEYWORDS = new Set([
  'int', 'int8', 'int16', 'int32', 'int64', 'uint', 'uint8',
  'uint16', 'uint32', 'uint64', 'float32', 'float64', 'complex64',
  'complex128', 'bool', 'string', 'byte', 'rune', 'error',
  'true', 'false', 'nil', 'iota', 'int64',
  'if', 'else', 'for', 'range', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'go', 'defer', 'select',
  'func', 'type', 'struct', 'interface', 'map', 'chan', 'const',
  'var', 'package', 'import', 'fallthrough', 'goto',
  'len', 'cap', 'make', 'new', 'append', 'copy', 'close', 'delete',
  'panic', 'recover', 'print', 'println', 'error',
  'fmt', 'Println', 'Printf', 'Sprintf',
  'int', 'string', 'int32',
]);

const RUST_KEYWORDS = new Set([
  'let', 'mut', 'const', 'static', 'fn', 'struct', 'enum', 'trait',
  'impl', 'type', 'self', 'Self', 'true', 'false', 'if', 'else',
  'match', 'for', 'while', 'loop', 'in', 'return', 'break',
  'continue', 'unsafe', 'pub', 'use', 'mod', 'crate', 'super',
  'where', 'as', 'ref', 'move', 'async', 'await', 'dyn',
  'i32', 'i64', 'u32', 'u64', 'f32', 'f64', 'bool', 'char', 'str',
  'String', 'Vec', 'Option', 'Result', 'Box', 'Rc', 'Arc',
  'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet',
  'println', 'print', 'format', 'vec', 'Some', 'None', 'Ok', 'Err',
  'clone', 'copy', 'iter', 'map', 'collect', 'unwrap', 'expect',
  'ToOwned', 'as_mut', 'as_ref', 'as_ptr',
]);

function getKeywordSet(language: string): Set<string> {
  const lang = language.toLowerCase();
  if (lang.startsWith('python')) return PYTHON_KEYWORDS;
  if (['javascript', 'typescript', 'js', 'ts'].includes(lang)) return JS_TS_KEYWORDS;
  if (['cpp', 'c', 'c++', 'c++14', 'c++17', 'c++20'].includes(lang)) return CPP_KEYWORDS;
  if (['java'].includes(lang)) return JAVA_KEYWORDS;
  if (['go'].includes(lang)) return GO_KEYWORDS;
  if (['rust'].includes(lang)) return RUST_KEYWORDS;
  // Generic fallback for unsupported languages
  return new Set([
    'if', 'else', 'for', 'while', 'return', 'break', 'continue',
    'function', 'class', 'var', 'let', 'const', 'new', 'this',
    'true', 'false', 'null', 'undefined', 'void', 'import',
    'export', 'default', 'try', 'catch', 'finally', 'throw',
    'switch', 'case', 'do', 'in', 'of', 'typeof', 'instanceof',
    'async', 'await', 'yield', 'int', 'float', 'double', 'char',
    'bool', 'string', 'void', 'long', 'short', 'unsigned',
  ]);
}

function getPatterns(language: string): LangPatterns {
  const lang = language.toLowerCase();

  if (lang.startsWith('python')) {
    return {
      // Variables: name = value or name: type = value or name +=/-=/etc value
      variable: /^(\s*)(\w+)\s*(?:=|:|=|,\s*\w+\s*=)/gm,
      // Functions: def name(
      function: /^(\s*)def\s+(\w+)\s*\(/gm,
      // Classes: class Name
      class: /^(\s*)class\s+(\w+)\s*[:\(]/gm,
      // Parameters: def func(..., param, ...)
      parameter: /def\s+\w+\s*\(([^)]*)\)/g,
      // Loop vars: for name in / for name in range(
      loopVar: /^\s*for\s+(\w+)\s+in\s/gm,
    };
  }

  if (['javascript', 'typescript', 'js', 'ts'].includes(lang)) {
    return {
      variable: /(?:let|var|const)\s+(\w+)\s*(?:=|;|,)/g,
      function: /(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=])?=>|(\w+)\s*\([^)]*\)\s*\{)/g,
      class: /class\s+(\w+)/g,
      parameter: /(?:function|=>)\s*(?:\w+\s*)?\(([^)]*)\)/g,
      loopVar: /(?:for\s*\(\s*(?:let|var|const)?\s*(\w+)\s*(?:of|in)|for\s+(?:let|var|const)?\s*(\w+)\s+(?:of|in)\s)/g,
    };
  }

  if (['cpp', 'c', 'c++', 'c++14', 'c++17', 'c++20'].includes(lang)) {
    return {
      variable: /(?:\b(int|long|float|double|char|bool|string|auto|size_t|int64_t|uint64_t|int32_t|uint32_t|ll|long\s+long)\s+)(\w+)/g,
      function: /(\w+)\s*\([^)]*\)\s*(?:const|override|final|\{|;)/g,
      class: /(?:class|struct)\s+(\w+)/g,
      parameter: /(\w+)\s*\(([^)]*\))/g,
      loopVar: /for\s*\(\s*(?:int|long|auto|size_t)?\s*(\w+)\s*(?:=|:|<)/g,
    };
  }

  if (lang === 'java') {
    return {
      variable: /(?:\b(int|long|float|double|char|boolean|byte|short|String|Integer|Long|Double|Boolean|List|ArrayList|Map|HashMap|Set|HashSet|Queue|LinkedList|Stack|PriorityQueue|Deque|ArrayDeque)\s+)(\w+)/g,
      function: /(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*\{/g,
      class: /class\s+(\w+)/g,
      parameter: /(\w+)\s+(\w+)\s*[,)]/g,
      loopVar: /for\s*\(\s*(?:int|long|String|var)?\s*(\w+)\s*(?::|;)/g,
    };
  }

  if (lang === 'go') {
    return {
      variable: /(?:var\s+(\w+)|(\w+)\s*:=)/g,
      function: /func\s+(\w+)\s*\(/g,
      class: /type\s+(\w+)\s+(?:struct|interface)\b/g,
      parameter: /func\s*(?:\w+)?\s*\(([^)]*)\)\s*(?:\w+)?/g,
      loopVar: /for\s+(?:_|(\w+))\s*(?::=|range)\s/g,
    };
  }

  if (lang === 'rust') {
    return {
      variable: /(?:let\s+(?:mut\s+)?(\w+)|(\w+)\s*=\s*[^=])/g,
      function: /fn\s+(\w+)\s*\(/g,
      class: /struct\s+(\w+)|enum\s+(\w+)/g,
      parameter: /fn\s*(?:\w+)?\s*\(([^)]*)\)/g,
      loopVar: /for\s+(\w+)\s+in\s/g,
    };
  }

  // Generic fallback
  return {
    variable: /(\w+)\s*=\s*[^=]/g,
    function: /(\w+)\s*\(/g,
    class: /(?:class|struct)\s+(\w+)/g,
    parameter: /function\s*(?:\w+)?\s*\(([^)]*)\)/g,
    loopVar: /for\s+(\w+)\s/g,
  };
}

export class IdentifierIndex {
  private symbols: Map<string, IdentifierSymbol[]> = new Map();
  private scopeStack: Array<{ name: string; type: 'global' | 'function' | 'class' }> = [];
  private language = 'unknown';
  private lastContent = '';

  /**
   * Rebuild the entire index from editor content.
   * Should be called on debounced content changes (150-200ms).
   */
  rebuild(content: string, language: string, cursorLine: number): void {
    if (content === this.lastContent && language === this.language) return;
    this.lastContent = content;
    this.language = language;
    this.symbols.clear();

    if (!content || content.length === 0) return;

    const supportedLangs = ['python', 'javascript', 'typescript', 'js', 'ts',
      'cpp', 'c', 'c++', 'java', 'go', 'rust'];
    const isSupported = supportedLangs.some(l => language.toLowerCase().startsWith(l) || language.toLowerCase() === l);
    if (!isSupported) return;

    const patterns = getPatterns(language);
    const keywords = getKeywordSet(language);
    const lines = content.split('\n');

    // Track scope by analyzing indentation
    this.scopeStack = [];
    let currentFunction = '';
    let currentClass = '';
    let braceDepth = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      // Track brace depth for C-like languages
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
      }

      // Determine scope for this line
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      while (this.scopeStack.length > 0 &&
             this.scopeStack[this.scopeStack.length - 1].name.startsWith('__indent_') &&
             indent <= (this.scopeStack[this.scopeStack.length - 1] as any).indent) {
        this.scopeStack.pop();
      }

      // Extract identifiers from this line (run ALL patterns)
      this._extractMatches(line, patterns.function, (name) => {
        if (keywords.has(name)) return;
        currentFunction = name;
        this._addSymbol(name, 'function', braceDepth <= 1 ? 'global' : 'function', currentClass || 'global', lineIdx);
      });

      this._extractMatches(line, patterns.class, (name) => {
        if (keywords.has(name)) return;
        currentClass = name;
        this._addSymbol(name, 'class', 'global', 'global', lineIdx);
      });

      // Extract variables: look for assignments
      this._extractVariables(line, language, (name, type) => {
        if (keywords.has(name) || name.length === 0) return;
        let scope: 'global' | 'function' | 'class' | 'local' = 'local';
        if (braceDepth <= 0 && !currentFunction && !currentClass) scope = 'global';
        else if (currentClass && !currentFunction) scope = 'class';
        else if (currentFunction) scope = 'function';
        else if (braceDepth <= 1) scope = 'global';
        this._addSymbol(name, type, scope, currentFunction || currentClass || 'global', lineIdx);
      });

      // Extract loop variables
      this._extractMatches(line, patterns.loopVar, (name) => {
        if (keywords.has(name)) return;
        this._addSymbol(name, 'loop_variable', 'local', currentFunction || currentClass || 'global', lineIdx);
      });
    }
  }

  /**
   * Get all identifier names for autocomplete, sorted by relevance:
   * 1. Exact prefix matches first
   * 2. Identifiers from current scope
   * 3. Recently used (higher usageCount)
   * 4. Identifiers from global scope
   */
  getMatches(prefix: string, cursorLine: number): IdentifierMatch[] {
    if (!prefix || prefix.length < 1) return [];

    const prefixLower = prefix.toLowerCase();
    const matches: IdentifierMatch[] = [];

    for (const [name, symbols] of this.symbols.entries()) {
      if (name === prefix) {
        // Exact match
        for (const sym of symbols) {
          matches.push({ symbol: sym, matchType: 'exact' });
        }
      } else if (name.startsWith(prefix) || name.toLowerCase().startsWith(prefixLower)) {
        // Prefix match (case-insensitive)
        for (const sym of symbols) {
          matches.push({ symbol: sym, matchType: 'prefix' });
        }
      } else if (name.includes(prefix) || name.toLowerCase().includes(prefixLower)) {
        // Fuzzy substring match (lower priority)
        for (const sym of symbols) {
          matches.push({ symbol: sym, matchType: 'fuzzy' });
        }
      }
    }

    // Sort by relevance
    matches.sort((a, b) => {
      // Exact match > prefix > fuzzy
      const aScore = a.matchType === 'exact' ? 3 : a.matchType === 'prefix' ? 2 : 1;
      const bScore = b.matchType === 'exact' ? 3 : b.matchType === 'prefix' ? 2 : 1;
      if (aScore !== bScore) return bScore - aScore;

      // Check if either is in the current cursor scope
      const aScopeScore = this._scopeProximity(a.symbol, cursorLine);
      const bScopeScore = this._scopeProximity(b.symbol, cursorLine);
      if (aScopeScore !== bScopeScore) return bScopeScore - aScopeScore;

      // Higher usage count = more relevant
      if (a.symbol.usageCount !== b.symbol.usageCount) {
        return b.symbol.usageCount - a.symbol.usageCount;
      }

      // Shorter name first
      if (a.symbol.name.length !== b.symbol.name.length) {
        return a.symbol.name.length - b.symbol.name.length;
      }

      // Alphabetical
      return a.symbol.name.localeCompare(b.symbol.name);
    });

    return matches;
  }

  /**
   * Record usage of an identifier (increments usageCount).
   */
  recordUsage(name: string): void {
    const symbols = this.symbols.get(name);
    if (symbols) {
      for (const sym of symbols) {
        sym.usageCount++;
      }
    }
  }

  /**
   * Check if the content has changed enough to warrant a rebuild.
   */
  hasContentChanged(newContent: string, newLanguage: string): boolean {
    const MIN_CHANGE_LENGTH = 3;
    if (this.language !== newLanguage) return true;
    if (newContent.length === 0 && this.lastContent.length > 0) return true;
    if (Math.abs(newContent.length - this.lastContent.length) > MIN_CHANGE_LENGTH) return true;
    return false;
  }

  // ── Private helpers ───────────────────────────────────────────

  private _addSymbol(
    name: string,
    type: IdentifierSymbol['type'],
    scope: IdentifierSymbol['scope'],
    scopeName: string,
    line: number,
  ): void {
    if (!name || name.length === 0 || name.length > 100) return;
    // Skip numbers and common non-identifier patterns
    if (/^\d/.test(name)) return;

    const existing = this.symbols.get(name);
    if (existing) {
      // Don't add duplicate if same name+type+scope combination exists
      const dup = existing.find(s => s.type === type && s.scope === scope && s.scopeName === scopeName);
      if (dup) {
        dup.usageCount++;
        return;
      }
      existing.push({ name, type, scope, scopeName, line, usageCount: 1 });
    } else {
      this.symbols.set(name, [{ name, type, scope, scopeName, line, usageCount: 1 }]);
    }
  }

  private _extractMatches(
    line: string,
    regex: RegExp,
    callback: (name: string) => void,
  ): void {
    // Clone regex to avoid state issues
    const re = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      // Find the first non-undefined capture group
      for (let i = 1; i < match.length; i++) {
        if (match[i] !== undefined && match[i].length > 0 && /^[a-zA-Z_]\w*$/.test(match[i])) {
          callback(match[i]);
          break;
        }
      }
    }
  }

  private _extractVariables(
    line: string,
    language: string,
    callback: (name: string, type: IdentifierSymbol['type']) => void,
  ): void {
    const lang = language.toLowerCase();

    // Pattern 1: Variable assignments (name = value)
    const assignRe = /(\b[a-zA-Z_]\w*)\s*=(?!=)/g;
    let match: RegExpExecArray | null;
    while ((match = assignRe.exec(line)) !== null) {
      const name = match[1];
      // Only match if it looks like a declaration
      if (line.trimStart().startsWith(name) ||
          /(let|var|const|int|long|float|double|char|bool|string|auto|size_t)\s+$/.test(line.substring(0, match.index))) {
        callback(name, 'variable');
      }
    }

    // Pattern 2: Python-style assignments (name = value at start of statement)
    const pyAssignRe = /^\s*(\b[a-zA-Z_]\w*)\s*=(?!=)/gm;
    if (lang.startsWith('python')) {
      while ((match = pyAssignRe.exec(line)) !== null) {
        callback(match[1], 'variable');
      }
    }

    // Pattern 3: Destructuring (a, b, c = ...)
    const destructureRe = /(\b[a-zA-Z_]\w*)\s*,\s*(\b[a-zA-Z_]\w*)\s*,?\s*(?:\b[a-zA-Z_]\w*)?\s*=\s*/g;
    while ((match = destructureRe.exec(line)) !== null) {
      callback(match[1], 'variable');
      callback(match[2], 'variable');
      if (match[3]) callback(match[3], 'variable');
    }
  }

  /**
   * Score how close a symbol is to the cursor.
   * Higher score = more relevant.
   */
  private _scopeProximity(symbol: IdentifierSymbol, cursorLine: number): number {
    // Same line = highest priority
    if (symbol.line === cursorLine) return 5;
    // Defined close to cursor (within 5 lines)
    if (Math.abs(symbol.line - cursorLine) <= 5) return 4;
    // Same function scope = high priority
    if (symbol.scope === 'local' || symbol.scope === 'function') return 3;
    // Same class scope
    if (symbol.scope === 'class') return 2;
    // Global scope
    if (symbol.scope === 'global') return 1;
    return 0;
  }
}
