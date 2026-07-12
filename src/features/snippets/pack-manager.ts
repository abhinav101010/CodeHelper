/**
 * SnippetPackManager
 *
 * Manages snippet packs for CodeHelper.
 * Fetches the pack index from a remote GitHub URL (with local fallback),
 * downloads snippet JSON on install, and serves snippets to SnippetEngine.
 *
 * Now with version tracking, update detection, and one-click update.
 */

import { SettingsManager } from '../../core/settings';
import type { Settings, SnippetPack } from '../../types/settings';
import type { Snippet } from '../../types/snippet';
import { generatePackDiffFromInternal } from './diff-engine';
import type { PackDiff } from './diff-engine';

// ═══════════════════════════════════════════════════════════════════════════
//  Remote & local data sources
// ═══════════════════════════════════════════════════════════════════════════

/** Base URL for the GitHub repository raw content. */
const GITHUB_BASE =
  'https://raw.githubusercontent.com/abhinav101010/CodeHelper/main';

/** Remote pack index — lives inside src/packs/, NOT src/snippets/. */
const REMOTE_PACK_INDEX = `${GITHUB_BASE}/src/packs/index.json`;

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
//  chrome.storage keys
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY_PACK_PREFIX = 'ch-pack-';
const STORAGE_KEY_PACK_META_SUFFIX = '-meta';
const STORAGE_KEY_DISMISSED_UPDATES = 'ch-dismissed-updates';
const STORAGE_KEY_IGNORED_UPDATES = 'ch-ignored-updates';

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
  return `${STORAGE_KEY_PACK_PREFIX}${packId}`;
}

function packMetaStorageKey(packId: string): string {
  return `${STORAGE_KEY_PACK_PREFIX}${packId}${STORAGE_KEY_PACK_META_SUFFIX}`;
}

/** Version metadata stored alongside snippet data. */
interface PackVersionMeta {
  version: string;
  lastUpdated: string;
  installedAt: string;
  snippetCount: number;
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
    chrome.storage.local.remove([packStorageKey(packId), packMetaStorageKey(packId)], () => resolve());
  });
}

function savePackMeta(packId: string, meta: PackVersionMeta): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [packMetaStorageKey(packId)]: meta }, () => resolve());
  });
}

function loadPackMeta(packId: string): Promise<PackVersionMeta | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(packMetaStorageKey(packId), (result) => {
      const raw = result[packMetaStorageKey(packId)];
      if (raw && typeof raw === 'object') {
        resolve(raw as PackVersionMeta);
      } else {
        resolve(null);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Dismissed / ignored update helpers (session + permanent)
// ═══════════════════════════════════════════════════════════════════════════

/** Get set of pack IDs dismissed for this session (chrome.storage.session). */
function getDismissedUpdates(): Promise<Set<string>> {
  return new Promise((resolve) => {
    if (typeof chrome.storage.session === 'undefined') {
      resolve(new Set());
      return;
    }
    chrome.storage.session.get(STORAGE_KEY_DISMISSED_UPDATES, (result) => {
      const arr = result[STORAGE_KEY_DISMISSED_UPDATES] as string[] | undefined;
      resolve(new Set(arr ?? []));
    });
  });
}

/** Mark a pack update as dismissed for this session. */
function markDismissedUpdate(packId: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome.storage.session === 'undefined') {
      resolve();
      return;
    }
    getDismissedUpdates().then((dismissed) => {
      dismissed.add(packId);
      chrome.storage.session.set(
        { [STORAGE_KEY_DISMISSED_UPDATES]: [...dismissed] },
        () => resolve(),
      );
    });
  });
}

/** Get set of permanently ignored update pack IDs. */
function getIgnoredUpdates(): Promise<Set<string>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY_IGNORED_UPDATES, (result) => {
      const arr = result[STORAGE_KEY_IGNORED_UPDATES] as string[] | undefined;
      resolve(new Set(arr ?? []));
    });
  });
}

/** Permanently ignore updates for a pack. */
function markIgnoredUpdate(packId: string): Promise<void> {
  return new Promise((resolve) => {
    getIgnoredUpdates().then((ignored) => {
      ignored.add(packId);
      chrome.storage.local.set(
        { [STORAGE_KEY_IGNORED_UPDATES]: [...ignored] },
        () => resolve(),
      );
    });
  });
}

/** Remove a pack from the ignored list. */
function unmarkIgnoredUpdate(packId: string): Promise<void> {
  return new Promise((resolve) => {
    getIgnoredUpdates().then((ignored) => {
      ignored.delete(packId);
      chrome.storage.local.set(
        { [STORAGE_KEY_IGNORED_UPDATES]: [...ignored] },
        () => resolve(),
      );
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Update info type
// ═══════════════════════════════════════════════════════════════════════════

export interface PackUpdateInfo {
  pack: SnippetPack;
  currentVersion: string;
  remoteVersion: string;
  diff: PackDiff;
  /** The raw rawCollection (for applying the update). */
  rawCollection: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SnippetPackManager
// ═══════════════════════════════════════════════════════════════════════════

export class SnippetPackManager {
  private settingsManager: SettingsManager;
  private cachedIndex: PackIndex | null = null;
  private installedSnippetsCache: Map<string, Snippet[]> = new Map();
  /** Cached raw JSON for packs (used for diffing). */
  private rawCollectionCache: Map<string, Record<string, any>> = new Map();
  /** Cached update info (populated after checkForUpdates). */
  private pendingUpdates: PackUpdateInfo[] = [];

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

    const remoteUrl = url ?? REMOTE_PACK_INDEX;

    console.log('[CodeHelper] Fetching remote pack index:', remoteUrl);

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
   * 3. Persist to chrome.storage.local (snippets + version meta)
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
        console.log('[CodeHelper] Downloading snippet pack:', pack.url);
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
      const snippetCount = Object.keys(rawCollection).length;

      // 3a. Persist snippets to chrome.storage.local
      await saveSnippetsToLocal(pack.id, snippets);

      // 3b. Persist version metadata
      const now = new Date().toISOString();
      await savePackMeta(pack.id, {
        version: pack.version,
        lastUpdated: pack.lastUpdated ?? now,
        installedAt: now,
        snippetCount,
      });

      // 4. Mark installed + enabled in chrome.storage.sync
      if (existingIdx >= 0) {
        installedPacks[existingIdx] = {
          ...pack,
          installed: true,
          enabled: true,
          installedAt: now,
          snippetCount,
        };
      } else {
        installedPacks.push({
          ...pack,
          installed: true,
          enabled: true,
          installedAt: now,
          snippetCount,
        });
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
      this.rawCollectionCache.set(pack.id, rawCollection);

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
      this.rawCollectionCache.delete(packId);

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
  //  Update detection & management
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Check all installed packs for available updates.
   *
   * 1. Fetches the remote index (or uses cached).
   * 2. For each installed pack, compares versions.
   * 3. If a newer version exists, downloads the remote snippet JSON,
   *    generates a diff, and stores the update info.
   *
   * Returns the list of pending updates. Also caches them internally.
   */
  async checkForUpdates(): Promise<PackUpdateInfo[]> {
    this.pendingUpdates = [];

    const index = await this.fetchIndex();
    if (!index) {
      console.warn('[CodeHelper] PackManager: cannot check updates, no index');
      return [];
    }

    const installedPacks = await this.getInstalledPacks();
    if (installedPacks.length === 0) return [];

    const dismissed = await getDismissedUpdates();
    const ignored = await getIgnoredUpdates();

    const updates: PackUpdateInfo[] = [];

    for (const installed of installedPacks) {
      if (!installed.installed) continue;

      // Skip if dismissed for this session or permanently ignored
      if (dismissed.has(installed.id) || ignored.has(installed.id)) continue;

      // Find the matching remote pack entry
      const remotePack = index.packs.find((p) => p.id === installed.id);
      if (!remotePack) continue;

      // Compare versions — if remote version is newer
      const needsUpdate = this.versionNeedsUpdate(
        installed.version,
        remotePack.version,
        installed.lastUpdated,
        remotePack.lastUpdated,
      );
      if (!needsUpdate) continue;

      // Download remote snippet JSON for diffing
      let rawCollection: Record<string, any>;
      try {
        console.log('[CodeHelper] Downloading snippet pack for diff:', remotePack.url);
        const response = await fetchWithTimeout(remotePack.url, FETCH_TIMEOUT_MS);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        rawCollection = await response.json();
      } catch (err) {
        console.warn(
          `[CodeHelper] PackManager: failed to download pack "${remotePack.id}" for update check:`,
          err,
        );
        continue;
      }

      if (!rawCollection || typeof rawCollection !== 'object') continue;

      // Generate diff against installed snippets
      const oldSnippets = await this.getSnippetsForPack(installed);
      const newSnippets = this.validateAndConvert(rawCollection);
      const diff = generatePackDiffFromInternal(oldSnippets, newSnippets);

      updates.push({
        pack: { ...remotePack, remoteVersion: remotePack.version },
        currentVersion: installed.version,
        remoteVersion: remotePack.version,
        diff,
        rawCollection,
      });
    }

    this.pendingUpdates = updates;
    return updates;
  }

  /**
   * Get cached pending updates (from the last checkForUpdates call).
   */
  getPendingUpdates(): PackUpdateInfo[] {
    return this.pendingUpdates;
  }

  /**
   * Apply an update for a specific pack.
   *
   * 1. Uses the cached rawCollection from checkForUpdates.
   * 2. Re-validates and converts snippets.
   * 3. Replaces stored snippets + version meta.
   * 4. Updates the pack version in chrome.storage.sync.
   */
  async updatePack(packId: string): Promise<boolean> {
    const update = this.pendingUpdates.find((u) => u.pack.id === packId);
    if (!update) {
      console.warn(`[CodeHelper] PackManager: no pending update for "${packId}"`);
      return false;
    }

    try {
      await this.settingsManager.init();
      const current = this.settingsManager.current;

      // Re-validate the downloaded data
      const newSnippets = this.validateAndConvert(update.rawCollection);
      const snippetCount = Object.keys(update.rawCollection).length;
      const now = new Date().toISOString();

      // Persist snippets
      await saveSnippetsToLocal(packId, newSnippets);

      // Persist version metadata
      await savePackMeta(packId, {
        version: update.remoteVersion,
        lastUpdated: update.pack.lastUpdated ?? now,
        installedAt: now,
        snippetCount,
      });

      // Update pack version in settings
      const installedPacks = (current.features.snippets.installedPacks || []).map((p) =>
        p.id === packId
          ? {
              ...p,
              version: update.remoteVersion,
              lastUpdated: update.pack.lastUpdated,
              installedAt: now,
              snippetCount,
            }
          : p,
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

      // Update in-memory cache
      this.installedSnippetsCache.set(packId, newSnippets);
      this.rawCollectionCache.set(packId, update.rawCollection);

      // Remove from pending updates
      this.pendingUpdates = this.pendingUpdates.filter((u) => u.pack.id !== packId);

      return true;
    } catch (err) {
      console.warn(`[CodeHelper] PackManager: update failed for "${packId}":`, err);
      return false;
    }
  }

  /**
   * Update ALL packs with pending updates.
   * Returns a map of packId → success.
   */
  async updateAllPacks(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const updates = [...this.pendingUpdates];
    for (const update of updates) {
      const ok = await this.updatePack(update.pack.id);
      results.set(update.pack.id, ok);
    }
    return results;
  }

  /**
   * Dismiss an update notification for the current session.
   */
  async dismissUpdate(packId: string): Promise<void> {
    await markDismissedUpdate(packId);
    this.pendingUpdates = this.pendingUpdates.filter((u) => u.pack.id !== packId);
  }

  /**
   * Permanently ignore updates for a pack.
   */
  async ignoreUpdates(packId: string): Promise<void> {
    await markIgnoredUpdate(packId);
    this.pendingUpdates = this.pendingUpdates.filter((u) => u.pack.id !== packId);
  }

  /**
   * Re-enable updates for a previously ignored pack.
   */
  async enableUpdates(packId: string): Promise<void> {
    await unmarkIgnoredUpdate(packId);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Version comparison
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Determine if a pack needs an update.
   * Compares semantic versions first, then falls back to lastUpdated timestamps.
   */
  private versionNeedsUpdate(
    installedVer: string,
    remoteVer: string,
    installedDate?: string,
    remoteDate?: string,
  ): boolean {
    if (installedVer !== remoteVer) {
      // Parse semantic versions
      const installedParts = installedVer.split('.').map(Number);
      const remoteParts = remoteVer.split('.').map(Number);
      for (let i = 0; i < Math.max(installedParts.length, remoteParts.length); i++) {
        const a = installedParts[i] ?? 0;
        const b = remoteParts[i] ?? 0;
        if (b > a) return true;
        if (b < a) return false;
      }
      // If versions are equal after parsing, check dates
    }

    // Fall back to date comparison
    if (installedDate && remoteDate) {
      return new Date(remoteDate) > new Date(installedDate);
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Validation & normalization
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
