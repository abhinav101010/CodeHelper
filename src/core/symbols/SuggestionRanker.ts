/**
 * SuggestionRanker — Ranks DocumentSymbol[] matches for a given prefix
 * and cursor position.
 *
 * Ranking criteria (in order):
 *   1. Match quality: exact > prefix > substring
 *   2. Scope proximity (current scope first)
 *   3. Symbol kind priority (parameter > variable > function > class, etc.)
 *   4. Declaration distance (nearest first)
 *   5. Usage count (higher = better)
 *   6. Alphabetical
 *
 * Deduplication: for symbols with the same name,
 * keep only the highest-ranked one.
 */

import type { DocumentSymbol, SymbolMatch, SymbolKind } from './DocumentSymbol';
import { SYMBOL_KIND_PRIORITY } from './DocumentSymbol';

/**
 * Rank symbols for autocomplete suggestions.
 *
 * @param symbols - All matching symbols from the store
 * @param prefix - The user's current prefix
 * @param cursorLine - 0-based cursor line number
 * @param maxResults - Maximum number of results (default 20)
 * @returns Ranked SymbolMatch array
 */
export function rankSymbols(
  symbols: DocumentSymbol[],
  prefix: string,
  cursorLine: number,
  maxResults = 20,
): SymbolMatch[] {
  if (!symbols.length || !prefix) return [];

  const prefixLower = prefix.toLowerCase();
  const matches: SymbolMatch[] = [];

  for (const sym of symbols) {
    const matchType = getMatchType(sym.name, prefix, prefixLower);
    if (!matchType) continue; // no match

    const score = computeScore(sym, matchType, cursorLine);
    matches.push({ symbol: sym, matchType, score });
  }

  // Sort by score descending
  matches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.symbol.name.localeCompare(b.symbol.name);
  });

  // Deduplicate by name: keep only the highest-ranked entry
  const seen = new Set<string>();
  const deduped: SymbolMatch[] = [];
  for (const m of matches) {
    if (!seen.has(m.symbol.name)) {
      seen.add(m.symbol.name);
      deduped.push(m);
    }
  }

  return deduped.slice(0, maxResults);
}

/**
 * Determine how well a symbol name matches a prefix.
 * Returns null if there's no match.
 */
function getMatchType(
  name: string,
  prefix: string,
  prefixLower: string,
): 'exact' | 'prefix' | 'substring' | null {
  if (name === prefix) return 'exact';
  if (name.startsWith(prefix)) return 'prefix';
  if (name.toLowerCase().startsWith(prefixLower)) return 'prefix';
  if (name.includes(prefix) || name.toLowerCase().includes(prefixLower)) return 'substring';
  return null;
}

/**
 * Compute a numeric score for a symbol match.
 * Higher is better.
 */
function computeScore(
  sym: DocumentSymbol,
  matchType: 'exact' | 'prefix' | 'substring',
  cursorLine: number,
): number {
  let score = 0;

  // 1. Match quality (0-60 points)
  if (matchType === 'exact') score += 60;
  else if (matchType === 'prefix') {
    // Longer prefix matches score higher
    score += 30 + Math.min(sym.name.length, 10);
  } else {
    score += 10;
  }

  // 2. Scope proximity (0-20 points)
  score += scopeProximityScore(sym, cursorLine);

  // 3. Symbol kind priority (0-10 points, inverted)
  // Higher priority items (lower number) get more points
  const priority = SYMBOL_KIND_PRIORITY[sym.kind] ?? 20;
  score += Math.max(0, 15 - priority);

  // 4. Declaration distance (0-10 points)
  // Closer declarations score higher
  const distance = Math.abs(sym.declarationLine - cursorLine);
  score += Math.max(0, 10 - Math.min(distance, 10));

  // 5. Usage count bonus (0-5 points)
  score += Math.min(sym.usageCount, 5);

  return score;
}

/**
 * Compute scope proximity score.
 * A symbol in the current scope gets highest marks.
 */
function scopeProximityScore(sym: DocumentSymbol, cursorLine: number): number {
  if (sym.scopeStart === -1 && sym.scopeEnd === -1) return 5; // global

  // Same line as cursor
  if (sym.line === cursorLine) return 20;

  // Cursor is within this symbol's scope
  if (cursorLine >= sym.scopeStart && (sym.scopeEnd === -1 || cursorLine <= sym.scopeEnd)) {
    // Even better if it's defined near the cursor
    const dist = Math.abs(sym.line - cursorLine);
    if (dist <= 3) return 18;
    if (dist <= 10) return 15;
    return 12;
  }

  // Cursor is outside the symbol's scope
  const dist = Math.abs(sym.line - cursorLine);
  if (dist <= 3) return 10;
  if (dist <= 10) return 7;
  if (dist <= 25) return 4;
  return 2;
}
