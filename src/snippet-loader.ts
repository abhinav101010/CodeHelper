/**
 * VS Code Snippet Loader
 *
 * Loads VS Code–format snippet JSON files (.json) and converts them to
 * CodeHelper's internal Snippet format. Supports:
 * - prefix (string | string[])
 * - body (string | string[])
 * - description (string)
 * - scope (string of comma-separated languages)
 * - ${1:placeholder} and $1 tabstops
 * - $0 final cursor position
 *
 * Gracefully skips unsupported VS Code features.
 *
 * All six snippet files are statically imported at build time via the
 * preloadAll() call. Individual language access is synchronous after that.
 */

import type { Snippet } from './types/snippet';

// ── Static imports of all snippet JSON files ────────────────────────────────
// Vite inlines these as JavaScript objects during the build.

import pythonSnippets from './snippets/python.json';
import cppSnippets from './snippets/cpp.json';
import javascriptSnippets from './snippets/javascript.json';
import typescriptSnippets from './snippets/typescript.json';
import htmlSnippets from './snippets/html.json';
import cssSnippets from './snippets/css.json';

interface VSCodeSnippetEntry {
  prefix?: string | string[];
  body: string | string[];
  description?: string;
  scope?: string;
}

type VSCodeSnippetCollection = Record<string, VSCodeSnippetEntry>;

// ── Language → filename mapping ──────────────────────────────────────────────

const LANGUAGE_SNIPPET_MAP: Record<string, string> = {
  python: 'python',
  python3: 'python',
  cpp: 'cpp',
  c: 'cpp',
  'c++': 'cpp',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  html: 'html',
  css: 'css',
  go: 'go',
  rust: 'rust',
};

// ── Raw data mapping ─────────────────────────────────────────────────────────

const RAW_SNIPPET_DATA: Record<string, VSCodeSnippetCollection> = {
  python: pythonSnippets as VSCodeSnippetCollection,
  cpp: cppSnippets as VSCodeSnippetCollection,
  javascript: javascriptSnippets as VSCodeSnippetCollection,
  typescript: typescriptSnippets as VSCodeSnippetCollection,
  html: htmlSnippets as VSCodeSnippetCollection,
  css: cssSnippets as VSCodeSnippetCollection,
};

// ── Cache (converted Snippet[]) ─────────────────────────────────────────────

const snippetCache = new Map<string, Snippet[]>();

// ── Unsupported VS Code features detection ───────────────────────────────────

const UNSUPPORTED_PATTERNS = [
  /\$\{\d+\|/,          // ${1|a,b|} choices
  /\$\{\d+\//,          // ${1/regex/replacement/} transform
];

function hasUnsupportedFeatures(entry: VSCodeSnippetEntry): boolean {
  const bodyStr = Array.isArray(entry.body) ? entry.body.join('\n') : (entry.body || '');
  return UNSUPPORTED_PATTERNS.some((p) => p.test(bodyStr));
}

function normalizePrefix(prefix: string | string[] | undefined, fallback: string): string[] {
  if (Array.isArray(prefix)) return prefix.filter((p) => typeof p === 'string' && p.length > 0);
  if (typeof prefix === 'string' && prefix.length > 0) return [prefix];
  return [fallback];
}

function normalizeBody(body: string | string[] | undefined): string {
  if (typeof body === 'string') return body;
  if (Array.isArray(body)) return body.join('\n');
  return '';
}

function normalizeScope(scope: string | undefined, fallbackLang: string): string[] {
  if (typeof scope === 'string' && scope.length > 0) {
    return scope.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [fallbackLang];
}

// ── Conversion ───────────────────────────────────────────────────────────────

function convertVSCodeSnippets(
  collection: VSCodeSnippetCollection,
  filename: string,
): Snippet[] {
  const result: Snippet[] = [];
  for (const [name, entry] of Object.entries(collection)) {
    if (!entry || typeof entry !== 'object') continue;
    if (hasUnsupportedFeatures(entry)) continue;

    const prefix = normalizePrefix(entry.prefix, name);
    const body = normalizeBody(entry.body);
    const description = typeof entry.description === 'string' ? entry.description : name;
    const languages = normalizeScope(entry.scope, filename);

    if (prefix.length > 0 && body) {
      result.push({ prefix, body, description, language: languages });
    }
  }
  return result;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Preload ALL VS Code snippet files at once.
 * Call once during extension initialization.
 */
export function preloadAll(): void {
  for (const [filename, raw] of Object.entries(RAW_SNIPPET_DATA)) {
    if (!snippetCache.has(filename)) {
      snippetCache.set(filename, convertVSCodeSnippets(raw, filename));
    }
  }
}

/** Get cached VS Code snippets for a language. Returns empty if not loaded. */
export function getCachedSnippets(lang: string): Snippet[] {
  const filename = LANGUAGE_SNIPPET_MAP[lang];
  if (!filename) return [];
  return snippetCache.get(filename)?.slice() ?? [];
}

/** Check if snippets are loaded for a given language. */
export function isLoaded(lang: string): boolean {
  const filename = LANGUAGE_SNIPPET_MAP[lang];
  if (!filename) return false;
  return snippetCache.has(filename);
}

/** Get all cached languages. */
export function getCachedLanguages(): string[] {
  return Array.from(snippetCache.keys());
}

/** Clear cache (useful for testing or re-load). */
export function clearCache(): void {
  snippetCache.clear();
}
