/**
 * DocumentSymbolStore — In-memory symbol index.
 *
 * Maintains a Map<string, DocumentSymbol[]> keyed by symbol name
 * for O(1) prefix lookups. Supports batch insert, clear, query,
 * and usage tracking.
 *
 * Thread-safe for single-threaded JS execution.
 */

import type { DocumentSymbol, SymbolQuery, SymbolMatch } from './DocumentSymbol';
import { rankSymbols } from './SuggestionRanker';

export class DocumentSymbolStore {
  /** Primary index: name → symbol entries. */
  private index = new Map<string, DocumentSymbol[]>();

  /** Track all unique symbol names for iteration. */
  private allNames: string[] = [];

  /** Current language (for diagnostics). */
  private currentLanguage = '';

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Replace all symbols in the store.
   * This is a full rebuild — O(n) where n = symbol count.
   */
  setSymbols(symbols: DocumentSymbol[], language: string): void {
    this.index.clear();
    this.allNames = [];
    this.currentLanguage = language;

    for (const sym of symbols) {
      const name = sym.name;
      if (!name) continue;

      const existing = this.index.get(name);
      if (existing) {
        // Check for duplicate (same line + kind)
        const isDuplicate = existing.some(
          (e) => e.line === sym.line && e.kind === sym.kind,
        );
        if (!isDuplicate) {
          existing.push(sym);
        }
      } else {
        this.index.set(name, [sym]);
        this.allNames.push(name);
      }
    }

    // Sort names for consistent iteration
    this.allNames.sort();
  }

  /**
   * Add individual symbols (incremental update).
   * Callers should deduplicate before calling this.
   */
  addSymbols(symbols: DocumentSymbol[]): void {
    for (const sym of symbols) {
      const name = sym.name;
      if (!name) continue;

      const existing = this.index.get(name);
      if (existing) {
        const isDuplicate = existing.some(
          (e) => e.line === sym.line && e.kind === sym.kind,
        );
        if (!isDuplicate) {
          existing.push(sym);
        }
      } else {
        this.index.set(name, [sym]);
        this.allNames.push(name);
        this.allNames.sort();
      }
    }
  }

  /**
   * Remove specific symbols from the index.
   */
  removeSymbols(symbols: DocumentSymbol[]): void {
    for (const sym of symbols) {
      const name = sym.name;
      if (!name) continue;

      const existing = this.index.get(name);
      if (!existing) continue;

      const filtered = existing.filter(
        (e) => !(e.line === sym.line && e.kind === sym.kind),
      );

      if (filtered.length === 0) {
        this.index.delete(name);
        this.allNames = this.allNames.filter((n) => n !== name);
      } else {
        this.index.set(name, filtered);
      }
    }
  }

  /**
   * Clear all symbols.
   */
  clear(): void {
    this.index.clear();
    this.allNames = [];
    this.currentLanguage = '';
  }

  // ── Querying ──────────────────────────────────────────────────────

  /**
   * Get ranked suggestions for a prefix and cursor position.
   */
  getSuggestions(query: SymbolQuery): SymbolMatch[] {
    const { prefix, cursorLine, maxResults = 20 } = query;
    if (!prefix || prefix.length < 1) return [];

    const prefixLower = prefix.toLowerCase();
    const matchedSymbols: DocumentSymbol[] = [];

    // Find all symbols whose name matches the prefix
    for (const [name, symbols] of this.index.entries()) {
      const nameLower = name.toLowerCase();
      if (
        name === prefix ||
        name.startsWith(prefix) ||
        nameLower.startsWith(prefixLower) ||
        nameLower.includes(prefixLower)
      ) {
        for (const sym of symbols) {
          matchedSymbols.push(sym);
        }
      }
    }

    return rankSymbols(matchedSymbols, prefix, cursorLine, maxResults);
  }

  /**
   * Get symbols by exact name.
   */
  getByName(name: string): DocumentSymbol[] {
    return this.index.get(name)?.slice() ?? [];
  }

  /**
   * Check if any symbol with this name exists.
   */
  hasName(name: string): boolean {
    return this.index.has(name);
  }

  /**
   * Get all symbols (flattened).
   */
  getAllSymbols(): DocumentSymbol[] {
    const result: DocumentSymbol[] = [];
    for (const symbols of this.index.values()) {
      for (const sym of symbols) {
        result.push(sym);
      }
    }
    return result;
  }

  /**
   * Get total symbol count.
   */
  get size(): number {
    let count = 0;
    for (const symbols of this.index.values()) {
      count += symbols.length;
    }
    return count;
  }

  // ── Usage tracking ────────────────────────────────────────────────

  /**
   * Record usage of an identifier (increments usageCount).
   */
  recordUsage(name: string): void {
    const symbols = this.index.get(name);
    if (symbols) {
      for (const sym of symbols) {
        sym.usageCount++;
      }
    }
  }
}
