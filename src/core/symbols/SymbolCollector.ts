/**
 * SymbolCollector — Orchestrates per-line extraction and builds
 * the full DocumentSymbol[] for a document.
 *
 * Takes the full content string + language, splits into lines,
 * calls the appropriate extractor for each line, tracks scope
 * via ScopeResolver, and attaches scope metadata to every symbol.
 */

import type { DocumentSymbol } from './DocumentSymbol';
import { ScopeResolver } from './ScopeResolver';
import { getExtractor, type SymbolExtractorCallback } from './LanguageExtractors';

/**
 * Result of a collection pass.
 */
export interface CollectResult {
  symbols: DocumentSymbol[];
  language: string;
  lineCount: number;
}

/**
 * Collect all symbols from the given content.
 *
 * @param content - Full editor content
 * @param language - Normalized language string (e.g. 'python', 'cpp')
 * @returns A CollectResult with all discovered symbols
 */
export function collectSymbols(content: string, language: string): CollectResult {
  const extractor = getExtractor(language);
  if (!extractor) {
    return { symbols: [], language, lineCount: 0 };
  }

  const lines = content.split('\n');
  const scopeResolver = new ScopeResolver();
  scopeResolver.reset(language);

  const partialSymbols: Array<
    Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>
  > = [];

  // Phase 1: Extract symbols from each line
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line) continue;

    // Let the extractor call the callback for each symbol found
    const callback: SymbolExtractorCallback = (sym) => {
      partialSymbols.push(sym);
    };

    // Track scope before extraction (most symbols belong to the
    // scope that starts on this line, except the scope creator itself)
    const currentScope = scopeResolver.processLine(line, lineIdx);

    extractor(line, lineIdx, callback);
  }

  // Finalize scopes
  scopeResolver.finalize(lines.length - 1);

  // Phase 2: Attach scope metadata to each symbol
  const symbols: DocumentSymbol[] = partialSymbols.map((sym) => {
    const symbolScope = resolveSymbolScope(sym.line, scopeResolver.getStack());
    return {
      ...sym,
      language,
      scopeStart: symbolScope.startLine,
      scopeEnd: symbolScope.endLine,
      scopeName: symbolScope.name,
      usageCount: 0,
    };
  });

  return { symbols, language, lineCount: lines.length };
}

/**
 * Resolve which scope a symbol belongs to based on its line number.
 * Walks the scope stack from innermost to outermost.
 */
function resolveSymbolScope(
  line: number,
  scopes: Array<{ name: string; kind: string; startLine: number; endLine: number }>,
): { name: string; startLine: number; endLine: number } {
  // Walk from innermost (last) to outermost (first)
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i];
    if (scope.name === 'global') continue;
    if (line >= scope.startLine && (scope.endLine === -1 || line <= scope.endLine)) {
      return { name: scope.name, startLine: scope.startLine, endLine: scope.endLine };
    }
  }
  return { name: 'global', startLine: 0, endLine: -1 };
}
