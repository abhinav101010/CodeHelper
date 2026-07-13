/**
 * Language extractor registry.
 *
 * Maps normalized language strings to their extractor functions.
 * Adding a new language requires:
 *   1. Creating the extractor file
 *   2. Importing it here
 *   3. Adding it to EXTRACTOR_MAP
 */

import type { DocumentSymbol } from '../DocumentSymbol';
import { extractPythonSymbols } from './python';
import { extractCppSymbols } from './cpp';
import { extractJavaSymbols } from './java';
import { extractJavaScriptSymbols } from './javascript';
import { extractTypeScriptSymbols } from './typescript';
import { extractPhpSymbols } from './php';
import { extractCssSymbols } from './css';
import { extractHtmlSymbols } from './html';

/**
 * Callback signature for language extractors.
 * Each extractor calls this for every symbol it discovers on a line.
 * scopeStart/scopeEnd/scopeName/usageCount/language are filled in
 * later by SymbolCollector.
 */
export type SymbolExtractorCallback = (
  sym: Omit<DocumentSymbol, 'scopeStart' | 'scopeEnd' | 'scopeName' | 'usageCount' | 'language'>,
) => void;

/**
 * Extractor function signature.
 * Receives the line text (untrimmed), 0-based line index, and a callback.
 */
export type SymbolExtractor = (
  line: string,
  lineIdx: number,
  callback: SymbolExtractorCallback,
) => void;

/**
 * Map of normalized language → extractor.
 * Keep sorted alphabetically for maintainability.
 */
const EXTRACTOR_MAP: Record<string, SymbolExtractor> = {
  c: extractCppSymbols,
  'c++': extractCppSymbols,
  'c++14': extractCppSymbols,
  'c++17': extractCppSymbols,
  'c++20': extractCppSymbols,
  cpp: extractCppSymbols,
  css: extractCssSymbols,
  html: extractHtmlSymbols,
  java: extractJavaSymbols,
  java8: extractJavaSymbols,
  javascript: extractJavaScriptSymbols,
  js: extractJavaScriptSymbols,
  'node.js': extractJavaScriptSymbols,
  php: extractPhpSymbols,
  python: extractPythonSymbols,
  python3: extractPythonSymbols,
  python3x: extractPythonSymbols,
  swift: extractCppSymbols, // Swift is C-like; basic support
  ts: extractTypeScriptSymbols,
  typescript: extractTypeScriptSymbols,
};

/**
 * Get the extractor for a given normalized language string.
 * Returns null if the language is not supported.
 */
export function getExtractor(language: string): SymbolExtractor | null {
  return EXTRACTOR_MAP[language] ?? null;
}

/**
 * Get the list of supported language names.
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(EXTRACTOR_MAP);
}

/**
 * Check if a language is supported by the symbol index.
 */
export function isLanguageSupported(language: string): boolean {
  return language in EXTRACTOR_MAP;
}
