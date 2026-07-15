/**
 * Version Checker
 *
 * Fetches the remote snippet pack index from GitHub and compares
 * installed pack versions with remote versions.
 *
 * Used by the Settings page to display update notifications.
 *
 * Architecture
 * ────────────
 *   fetchRemoteIndex()    → GET index.json from GitHub
 *   compareVersions()     → Return list of updatable packs
 *   saveVersion()         → Persist version to chrome.storage.local
 *   getInstalledVersion() → Read from storage
 *
 * The actual download-and-replace logic lives in the SnippetPackManager.
 * This module only handles fetching and comparison.
 */

export interface RemotePackInfo {
  id: string;
  name: string;
  version: string;
  lastUpdated?: string;
  languages?: string[];
}

export interface RemoteIndex {
  version: number;
  packs: RemotePackInfo[];
}

export interface PackUpdate {
  packId: string;
  packName: string;
  currentVersion: string | null;
  remoteVersion: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const GITHUB_BASE = 'https://raw.githubusercontent.com/abhinav101010/CodeHelper/main';
const REMOTE_PACK_INDEX = `${GITHUB_BASE}/src/packs/index.json`;

const STORAGE_KEY_PREFIX = 'ch_pack_version_';

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch the remote snippet pack index.json.
 * Returns null on network error or invalid response.
 */
export async function fetchRemoteIndex(): Promise<RemoteIndex | null> {
  try {
    console.log('[CodeHelper] Fetching remote pack index:', REMOTE_PACK_INDEX);
    const response = await fetch(REMOTE_PACK_INDEX, { cache: 'no-cache' });
    if (!response.ok) {
      console.warn(
        `[CodeHelper] Remote pack index fetch failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }
    const data: RemoteIndex = await response.json();
    if (!data || !Array.isArray(data.packs)) {
      console.warn('[CodeHelper] Remote pack index has invalid format');
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[CodeHelper] Failed to fetch remote pack index:', err);
    return null;
  }
}

/**
 * Compare installed pack versions against remote versions.
 * Returns an array of packs that have updates available.
 *
 * @param remoteIndex - The remote pack index (from fetchRemoteIndex).
 * @returns Array of packs that need updating.
 */
export async function getUpdatablePacks(
  remoteIndex: RemoteIndex,
): Promise<PackUpdate[]> {
  const updates: PackUpdate[] = [];

  for (const pack of remoteIndex.packs) {
    const currentVersion = await getInstalledVersion(pack.id);
    if (currentVersion === null) continue; // Not installed — skip

    if (currentVersion !== pack.version) {
      updates.push({
        packId: pack.id,
        packName: pack.name,
        currentVersion,
        remoteVersion: pack.version,
      });
    }
  }

  return updates;
}

/**
 * Save a pack's version to chrome.storage.local (or localStorage fallback).
 */
export async function saveVersion(packId: string, version: string): Promise<void> {
  const key = `${STORAGE_KEY_PREFIX}${packId}`;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: version });
    } else {
      localStorage.setItem(key, version);
    }
  } catch {
    // Best-effort
    try {
      localStorage.setItem(key, version);
    } catch {
      // Ignore
    }
  }
}

/**
 * Read a pack's installed version from chrome.storage.local (or localStorage).
 * Returns null if the pack is not installed or version is unknown.
 */
export async function getInstalledVersion(packId: string): Promise<string | null> {
  const key = `${STORAGE_KEY_PREFIX}${packId}`;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key);
      return (result[key] as string) ?? null;
    }
    return localStorage.getItem(key);
  } catch {
    return localStorage.getItem(key);
  }
}

/**
 * Check whether two semantic version strings are different.
 * Simple string comparison — does not handle semver ranges.
 */
export function isVersionDifferent(
  currentVersion: string | null,
  remoteVersion: string,
): boolean {
  if (currentVersion === null) return false;
  return currentVersion !== remoteVersion;
}

/**
 * Compare two semantic version strings.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 * Handles "v" prefix optionally (e.g. "v1.0.0" and "1.0.0").
 */
export function compareSemVer(a: string, b: string): number {
  const cleanA = a.replace(/^v/, '');
  const cleanB = b.replace(/^v/, '');

  const partsA = cleanA.split('.').map(Number);
  const partsB = cleanB.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) return numA - numB;
  }

  return 0;
}
