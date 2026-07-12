/**
 * SnippetPackManager
 *
 * Manages snippet packs for CodeHelper.
 * Fetches the pack index from a remote GitHub URL (with local fallback),
 * downloads snippet JSON on install, and serves snippets to SnippetEngine.
 *
 * Responsibilities:
 * - Load available packs from remote index (with local fallback)
 * - Download + validate snippet JSON on pack install
 * - Manage install/uninstall/toggle state via chrome.storage.sync
 * - Cache installed snippets in chrome.storage.local and in-memory
 * - Return snippets to SnippetEngine
 */

import { SettingsManager } from '../../core/settings';
import type { Settings, SnippetPack } from '../../types/settings';
import type { Snippet } from '../../types/snippet';

// ═══════════════════════════════════════════════════════════════════════════
//  Remote & local data sources
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL =
  'https://raw.githubusercontent.com/abhinav101010/CodeHelper/main/src/snippets/';

import localPackIndex from '../../packs/index.json';

/** Pack index format. */
export interface PackIndex {
  version: number;
  packs: SnippetPack[];
}

/** Unsupported VS Code features. */
const UNSUPPORTED_PATTERNS = [
  // ${1/regex/replacement/} transform — not yet supported by our parser
  /\$\{\d+\//,
];

const FETCH_TIMEOUT_MS = 5_000;

// ═══════════════════════════════════════════════════════════════════════════
//  Helper: fetch with timeout
// ═══════════════════════════════════════════════════════════════════════════

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ═══════════════════════════════════════════════════════════════════════════
//  chrome.storage.local helpers
// ═══════════════════════════════════════════════════════════════════════════

function packStorageKey(packId: string): string {
  return `ch-pack-${packId}`;
}

function saveSnippetsToLocal(packId: string, snippets: Snippet[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [packStorageKey(packId)]: snippets }, () => resolve());
  });
}

function loadSnippetsFromLocal(packId: string): Promise<Snippet[] | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(packStorageKey(packId), (result) => {
      const raw = result[packStorageKey(packId)];
      if (Array.isArray(raw)) {
        resolve(raw as Snippet[]);
      } else {
        resolve(null);
      }
    });
  });
}

function removeSnippetsFromLocal(packId: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(packStorageKey(packId), () => resolve());
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  SnippetPackManager
// ═══════════════════════════════════════════════════════════════════════════

export class SnippetPackManager {
  private settingsManager: SettingsManager;
  private cachedIndex: PackIndex | null = null;
  private installedSnippetsCache: Map<string, Snippet[]> = new Map();

  constructor() {
    this.settingsManager = new SettingsManager();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Index
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Fetch the pack index. Tries the remote URL first (with a 5 s timeout),
   * falls back to the locally bundled index on failure.
   */
  async fetchIndex(url?: string): Promise<PackIndex | null> {
    if (this.cachedIndex) return this.cachedIndex;

    const remoteUrl = url ?? BASE_URL + 'index.json';

    try {
      const response = await fetchWithTimeout(remoteUrl, FETCH_TIMEOUT_MS);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const raw = await response.json();

      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.packs)) {
        throw new Error('Invalid remote index format');
      }

      this.cachedIndex = raw as PackIndex;
      return this.cachedIndex;
    } catch (err) {
      console.warn(
        '[CodeHelper] PackManager: remote index fetch failed, falling back to local:',
        err,
      );

      // Fallback: use the bundled local index
      try {
        const localRaw = localPackIndex;
        if (!localRaw || typeof localRaw !== 'object' || !Array.isArray(localRaw.packs)) {
          console.warn('[CodeHelper] PackManager: invalid local index format');
          return null;
        }
        this.cachedIndex = localRaw as unknown as PackIndex;
        return this.cachedIndex;
      } catch (localErr) {
        console.warn('[CodeHelper] PackManager: local index fallback also failed:', localErr);
        return null;
      }
    }
  }

  /**
   * Get the cached index (or load if not cached).
   */
  async getIndex(): Promise<PackIndex | null> {
    if (this.cachedIndex) return this.cachedIndex;
    return this.fetchIndex();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Install / Uninstall / Toggle
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Install a pack:
   * 1. Download the snippet JSON from pack.url
   * 2. Validate & convert to Snippet[]
   * 3. Persist to chrome.storage.local
   * 4. Mark installed+enabled in chrome.storage.sync
   * 5. Cache in memory
   */
  async installPack(pack: SnippetPack): Promise<boolean> {
    try {
      await this.settingsManager.init();
      const current = this.settingsManager.current;

      // Reject duplicate pack IDs
      const installedPacks = [...(current.features.snippets.installedPacks || [])];
      const existingIdx = installedPacks.findIndex((p) => p.id === pack.id);
      if (existingIdx >= 0 && installedPacks[existingIdx].installed) {
        console.warn(
          `[CodeHelper] PackManager: pack "${pack.id}" is already installed`,
        );
        return false;
      }

      // 1. Download snippet JSON
      let rawCollection: Record<string, any>;
      try {
        const response = await fetchWithTimeout(pack.url, FETCH_TIMEOUT_MS);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        rawCollection = await response.json();
      } catch (err) {
        console.warn(
          `[CodeHelper] PackManager: failed to download pack "${pack.id}":`,
          err,
        );
        return false;
      }

      if (!rawCollection || typeof rawCollection !== 'object') {
        console.warn(
          `[CodeHelper] PackManager: invalid JSON for pack "${pack.id}"`,
        );
        return false;
      }

      // 2. Validate & convert
      const snippets = this.validateAndConvert(rawCollection);

      // 3. Persist snippets to chrome.storage.local
      await saveSnippetsToLocal(pack.id, snippets);

      // 4. Mark installed + enabled in chrome.storage.sync
      if (existingIdx >= 0) {
        installedPacks[existingIdx] = { ...pack, installed: true, enabled: true };
      } else {
        installedPacks.push({ ...pack, installed: true, enabled: true });
      }

      await this.settingsManager.update({
        features: {
          ...current.features,
          snippets: {
            ...current.features.snippets,
            installedPacks,
          },
        },
      });

      // 5. Cache in memory
      this.installedSnippetsCache.set(pack.id, snippets);

      return true;
    } catch (err) {
      console.warn('[CodeHelper] PackManager: install failed:', err);
      return false;
    }
  }

  /**
   * Uninstall a pack:
   * 1. Remove from chrome.storage.sync
   * 2. Remove from chrome.storage.local
   * 3. Remove from in-memory cache
   */
  async uninstallPack(packId: string): Promise<boolean> {
    try {
      await this.settingsManager.init();
      const current = this.settingsManager.current;

      const installedPacks = (current.features.snippets.installedPacks || []).filter(
        (p) => p.id !== packId,
      );

      await this.settingsManager.update({
        features: {
          ...current.features,
          snippets: {
            ...current.features.snippets,
            installedPacks,
          },
        },
      });

      await removeSnippetsFromLocal(packId);
      this.installedSnippetsCache.delete(packId);

      return true;
    } catch (err) {
      console.warn('[CodeHelper] PackManager: uninstall failed:', err);
      return false;
    }
  }

  /**
   * Toggle a pack's enabled state (without uninstalling).
   */
  async togglePack(packId: string, enabled: boolean): Promise<boolean> {
    try {
      await this.settingsManager.init();
      const current = this.settingsManager.current;

      const installedPacks = (current.features.snippets.installedPacks || []).map((p) =>
        p.id === packId ? { ...p, enabled } : p,
      );

      await this.settingsManager.update({
        features: {
          ...current.features,
          snippets: {
            ...current.features.snippets,
            installedPacks,
          },
        },
      });
      return true;
    } catch (err) {
      console.warn('[CodeHelper] PackManager: toggle failed:', err);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Snippet retrieval
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Get installed packs from storage.
   */
  async getInstalledPacks(): Promise<SnippetPack[]> {
    try {
      await this.settingsManager.init();
      return this.settingsManager.current.features.snippets.installedPacks || [];
    } catch {
      return [];
    }
  }

  /**
   * Get snippets for a single pack.
   * Returns from in-memory cache, or loads from chrome.storage.local.
   */
  async getSnippetsForPack(pack: SnippetPack): Promise<Snippet[]> {
    // Fast path: in-memory cache
    if (this.installedSnippetsCache.has(pack.id)) {
      return this.installedSnippetsCache.get(pack.id) || [];
    }

    // Slow path: load from chrome.storage.local
    const stored = await loadSnippetsFromLocal(pack.id);
    if (stored) {
      this.installedSnippetsCache.set(pack.id, stored);
      return stored;
    }

    return [];
  }

  /**
   * Get ALL snippets from all installed + enabled packs.
   * Deduplicates by prefix (first prefix wins).
   */
  async getAllPackSnippets(): Promise<Snippet[]> {
    const packs = await this.getInstalledPacks();
    const enabledPacks = packs.filter((p) => p.enabled);

    const all: Snippet[] = [];
    const seenPrefixes = new Set<string>();

    for (const pack of enabledPacks) {
      const snippets = await this.getSnippetsForPack(pack);
      for (const snippet of snippets) {
        const key = snippet.prefix[0] ?? '';
        if (!seenPrefixes.has(key)) {
          seenPrefixes.add(key);
          all.push(snippet);
        }
      }
    }

    return all;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Validation & normalization (unchanged)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Validate a raw VS Code snippet collection and convert to internal format.
   * Gracefully skips entries with unsupported features.
   */
  validateAndConvert(rawCollection: Record<string, any>): Snippet[] {
    const snippets: Snippet[] = [];
    for (const [name, entry] of Object.entries(rawCollection)) {
      if (!entry || typeof entry !== 'object') continue;

      const prefix = this.normalizePrefix(entry.prefix, name);
      const body = this.normalizeBody(entry.body);
      const description = typeof entry.description === 'string' ? entry.description : name;
      const languages = this.normalizeScope(entry.scope, name);

      if (prefix.length === 0 || !body) continue;
      if (this.hasUnsupportedFeatures(entry)) continue;

      snippets.push({ prefix, body, description, language: languages });
    }
    return snippets;
  }

  normalizePrefix(prefix: string | string[] | undefined, fallback: string): string[] {
    if (Array.isArray(prefix)) return prefix.filter((p) => typeof p === 'string' && p.length > 0);
    if (typeof prefix === 'string' && prefix.length > 0) return [prefix];
    return [fallback];
  }

  normalizeBody(body: string | string[] | undefined): string {
    if (typeof body === 'string') return body;
    if (Array.isArray(body)) return body.join('\n');
    return '';
  }

  private normalizeScope(scope: string | undefined, fallbackLang: string): string[] {
    if (typeof scope === 'string' && scope.length > 0) {
      return scope.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [fallbackLang];
  }

  private hasUnsupportedFeatures(entry: any): boolean {
    const bodyStr = Array.isArray(entry.body) ? entry.body.join('\n') : (entry.body || '');
    return UNSUPPORTED_PATTERNS.some((p) => p.test(bodyStr));
  }
}

/** Singleton for use across the options page. */
export const snippetPackManager = new SnippetPackManager();
