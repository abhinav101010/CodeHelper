/**
 * diff-engine.ts
 *
 * Compares two snippet collections (raw VS Code JSON or internal Snippet[])
 * and produces a diff showing what was added, removed, or modified.
 *
 * Used by SnippetPackManager to generate update summaries for the
 * Pack Update Notifications UI.
 */

import type { Snippet } from '../../types/snippet';

/** Diff result for one pack. */
export interface PackDiff {
  added: string[];
  removed: string[];
  modified: string[];
  stats: {
    oldCount: number;
    newCount: number;
    changeCount: number;
  };
}

/**
 * Compare two raw VS Code snippet JSON objects and produce a diff.
 *
 * @param oldRaw  The previously installed snippet collection (key → entry).
 * @param newRaw  The newly fetched snippet collection (key → entry).
 */
export function generatePackDiffFromRaw(
  oldRaw: Record<string, any>,
  newRaw: Record<string, any>,
): PackDiff {
  const oldKeys = new Set(Object.keys(oldRaw));
  const newKeys = new Set(Object.keys(newRaw));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key);
    }
  }

  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key);
    }
  }

  for (const key of oldKeys) {
    if (newKeys.has(key)) {
      const oldEntry = oldRaw[key];
      const newEntry = newRaw[key];
      if (entriesDiffer(oldEntry, newEntry)) {
        modified.push(key);
      }
    }
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    modified: modified.sort(),
    stats: {
      oldCount: oldKeys.size,
      newCount: newKeys.size,
      changeCount: added.length + removed.length + modified.length,
    },
  };
}

/**
 * Compare two internal Snippet[] arrays and produce a diff.
 * Uses the first prefix as the key for comparison.
 */
export function generatePackDiffFromInternal(
  oldSnippets: Snippet[],
  newSnippets: Snippet[],
): PackDiff {
  const oldMap = new Map<string, Snippet>();
  for (const s of oldSnippets) {
    const key = s.prefix[0] ?? s.description;
    oldMap.set(key, s);
  }

  const newMap = new Map<string, Snippet>();
  for (const s of newSnippets) {
    const key = s.prefix[0] ?? s.description;
    newMap.set(key, s);
  }

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const [key, snippet] of newMap) {
    if (!oldMap.has(key)) {
      added.push(key);
    } else {
      const old = oldMap.get(key)!;
      if (
        old.body !== snippet.body ||
        old.description !== snippet.description ||
        JSON.stringify(old.prefix) !== JSON.stringify(snippet.prefix) ||
        JSON.stringify(old.language) !== JSON.stringify(snippet.language)
      ) {
        modified.push(key);
      }
    }
  }

  for (const [key] of oldMap) {
    if (!newMap.has(key)) {
      removed.push(key);
    }
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    modified: modified.sort(),
    stats: {
      oldCount: oldMap.size,
      newCount: newMap.size,
      changeCount: added.length + removed.length + modified.length,
    },
  };
}

/**
 * Deep-compare two VS Code snippet entries for equality.
 * Checks prefix, body, description, and scope.
 */
function entriesDiffer(a: any, b: any): boolean {
  // Compare prefix
  const prefixA = normalizeForCompare(a?.prefix);
  const prefixB = normalizeForCompare(b?.prefix);
  if (prefixA !== prefixB) return true;

  // Compare body (stringify arrays)
  const bodyA = typeof a?.body === 'string' ? a.body : (Array.isArray(a?.body) ? a.body.join('\n') : '');
  const bodyB = typeof b?.body === 'string' ? b.body : (Array.isArray(b?.body) ? b.body.join('\n') : '');
  if (bodyA !== bodyB) return true;

  // Compare description
  if ((a?.description ?? '') !== (b?.description ?? '')) return true;

  // Compare scope
  const scopeA = a?.scope ?? '';
  const scopeB = b?.scope ?? '';
  if (scopeA !== scopeB) return true;

  return false;
}

function normalizeForCompare(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val.join(',');
  if (typeof val === 'string') return val;
  return '';
}
