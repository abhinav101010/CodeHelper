/**
 * DocumentSymbolIndexer — Debounced content watcher that triggers
 * the collector → store pipeline.
 *
 * This is the main integration point for the editor/snippet engine.
 * Usage:
 *
 *   const indexer = new DocumentSymbolIndexer();
 *   indexer.updateContent(content, language);
 *   const suggestions = indexer.getSuggestions(prefix, cursorLine);
 *   indexer.recordUsage(name);
 *   indexer.dispose();
 *
 * Debouncing: content changes are debounced at 150ms by default.
 * For large files (>500 lines), processing is chunked via setTimeout(0)
 * to avoid blocking the main thread.
 */

import { collectSymbols } from './SymbolCollector';
import { DocumentSymbolStore } from './DocumentSymbolStore';
import type { SymbolMatch, SymbolQuery } from './DocumentSymbol';

const DEFAULT_DEBOUNCE_MS = 150;
const CHUNK_SIZE = 200; // lines per chunk for large files

export class DocumentSymbolIndexer {
  private store = new DocumentSymbolStore();
  private debounceMs: number;

  private debounceTimer: number | null = null;
  private lastContent = '';
  private lastLanguage = '';

  /** Callback for when indexing completes (for debugging). */
  public onIndexed: ((count: number) => void) | null = null;

  constructor(debounceMs = DEFAULT_DEBOUNCE_MS) {
    this.debounceMs = debounceMs;
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Called on every editor content change (debounced).
   * Re-indexes the document and updates the store.
   *
   * Large files are processed in chunks to avoid UI freezes.
   */
  updateContent(content: string, language: string): void {
    // Skip if nothing changed
    if (content === this.lastContent && language === this.lastLanguage) return;

    this.lastContent = content;
    this.lastLanguage = language;

    // Clear any pending debounce
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Debounce
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this._doIndex(content, language);
    }, this.debounceMs);
  }

  /**
   * Force an immediate re-index (bypasses debounce).
   * Useful before the user triggers a completion to ensure fresh data.
   */
  forceIndex(content: string, language: string): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.lastContent = content;
    this.lastLanguage = language;
    this._doIndex(content, language);
  }

  /**
   * Get ranked suggestions for the given prefix and cursor position.
   */
  getSuggestions(prefix: string, cursorLine: number): SymbolMatch[] {
    const query: SymbolQuery = { prefix, cursorLine };
    return this.store.getSuggestions(query);
  }

  /**
   * Record usage of an identifier (improves future ranking).
   */
  recordUsage(name: string): void {
    this.store.recordUsage(name);
  }

  /**
   * Force clear all indexed symbols.
   */
  clear(): void {
    this.store.clear();
    this.lastContent = '';
    this.lastLanguage = '';
  }

  /**
   * Dispose the indexer and clean up timers.
   */
  dispose(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.store.clear();
    this.lastContent = '';
    this.lastLanguage = '';
  }

  /**
   * Get the current symbol count (for diagnostics).
   */
  get symbolCount(): number {
    return this.store.size;
  }

  /**
   * Check if content/language has changed since last index.
   */
  hasContentChanged(content: string, language: string): boolean {
    return content !== this.lastContent || language !== this.lastLanguage;
  }

  // ── Internal ──────────────────────────────────────────────────────

  private _doIndex(content: string, language: string): void {
    const lineCount = content.split('\n').length;

    if (lineCount <= CHUNK_SIZE) {
      // Small file: index synchronously
      const result = collectSymbols(content, language);
      this.store.setSymbols(result.symbols, language);
      this.onIndexed?.(result.symbols.length);
    } else {
      // Large file: index in chunks
      this._indexLargeFile(content, language, lineCount);
    }
  }

  private _indexLargeFile(content: string, language: string, lineCount: number): void {
    const lines = content.split('\n');
    const allSymbols: Array<any> = [];
    let currentLine = 0;

    const processNextChunk = () => {
      const endLine = Math.min(currentLine + CHUNK_SIZE, lineCount);
      const chunkContent = lines.slice(currentLine, endLine).join('\n');
      const result = collectSymbols(chunkContent, language);
      allSymbols.push(...result.symbols);

      currentLine = endLine;

      if (currentLine < lineCount) {
        // Schedule next chunk
        setTimeout(processNextChunk, 0);
      } else {
        // Done — update store
        this.store.setSymbols(allSymbols, language);
        this.onIndexed?.(allSymbols.length);
      }
    };

    processNextChunk();
  }
}
