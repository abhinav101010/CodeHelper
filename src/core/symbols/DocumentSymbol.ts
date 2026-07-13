/**
 * DocumentSymbol — Symbol model for the Document Symbol Index.
 *
 * Every identifier in the editor becomes a DocumentSymbol with a kind,
 * position, scope information, and metadata for ranking.
 *
 * Designed for future extensibility:
 *   - Rename Symbol
 *   - Go to Definition
 *   - Find References
 *   - Hover Information
 *   - Breadcrumbs
 *   - Outline View
 *   - Semantic Highlighting
 */

/** All supported symbol kinds. */
export type SymbolKind =
  | 'class'
  | 'struct'
  | 'interface'
  | 'enum'
  | 'namespace'
  | 'function'
  | 'method'
  | 'constructor'
  | 'parameter'
  | 'variable'
  | 'loopVariable'
  | 'catchVariable'
  | 'field'
  | 'staticField'
  | 'property'
  | 'constant'
  | 'import';

/** Priority for ranking (lower number = higher priority). */
export const SYMBOL_KIND_PRIORITY: Record<SymbolKind, number> = {
  parameter: 1,
  catchVariable: 2,
  loopVariable: 3,
  variable: 4,
  field: 5,
  staticField: 6,
  property: 7,
  method: 8,
  function: 9,
  constructor: 10,
  class: 11,
  struct: 12,
  interface: 13,
  enum: 14,
  namespace: 15,
  constant: 16,
  import: 17,
};

export interface DocumentSymbol {
  /** Identifier name. */
  name: string;
  /** Symbol kind. */
  kind: SymbolKind;
  /** Normalized language (e.g. 'python', 'cpp'). */
  language: string;
  /** 0-based line number in the document. */
  line: number;
  /** 0-based column number in the document. */
  column: number;
  /** Line where this symbol was declared (same as line for simple decls). */
  declarationLine: number;
  /** Column where this symbol was declared. */
  declarationColumn: number;
  /** First line of the enclosing scope (-1 for global). */
  scopeStart: number;
  /** Last line of the enclosing scope (-1 for global). */
  scopeEnd: number;
  /** Name of the enclosing scope ('global' if none). */
  scopeName: string;
  /** Usage counter for frequency-based ranking. */
  usageCount: number;
}

/** Filter for querying the symbol store. */
export interface SymbolQuery {
  prefix: string;
  cursorLine: number;
  language?: string;
  maxResults?: number;
}

/** A ranked match returned by the suggestion engine. */
export interface SymbolMatch {
  symbol: DocumentSymbol;
  /** How well the prefix matched. */
  matchType: 'exact' | 'prefix' | 'substring';
  /** Computed relevance score (higher = better). */
  score: number;
}

/** Lightweight scope representation for tracking. */
export interface Scope {
  name: string;
  kind: 'global' | 'function' | 'class' | 'block' | 'loop' | 'namespace';
  startLine: number;
  endLine: number;
}
