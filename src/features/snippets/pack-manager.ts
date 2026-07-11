/**
 * SnippetPackManager
 *
 * Manages snippet packs for CodeHelper, loaded from a local bundled index.json.
 * The loading logic is abstracted so switching to a remote URL later only requires
 * changing the data source, not the UI or manager logic.
 *
 * Responsibilities:
 * - Load available packs from bundled index.json
 * - Manage install/uninstall/toggle state via chrome.storage.sync
 * - Return snippets to SnippetEngine
 */

import { SettingsManager } from '../../core/settings';
import type { Settings, SnippetPack } from '../../types/settings';
import type { Snippet } from '../../types/snippet';

// ═══════════════════════════════════════════════════════════════════════════
//  Local pack index — imported at build time by Vite
// ═══════════════════════════════════════════════════════════════════════════

import localPackIndex from '../../packs/index.json';

/** Pack index format. */
export interface PackIndex {
  version: number;
  packs: SnippetPack[];
}

/** Unsupported VS Code features. */
const UNSUPPORTED_PATTERNS = [
  /\$\{\d+\|/,          // ${1|a,b|} choices
  /\$\{\d+\//,          // ${1/regex/replacement/} transform
];

export class SnippetPackManager {
  private settingsManager: SettingsManager;
  private cachedIndex: PackIndex | null = null;
  private installedSnippetsCache: Map<string, Snippet[]> = new Map();

  constructor() {
    this.settingsManager = new SettingsManager();
  }

  /**
   * Load the pack index from the bundled local file.
   * Future: switch to remote URL by changing the import source.
   */
  async fetchIndex(_url?: string): Promise<PackIndex | null> {
    if (this.cachedIndex) return this.cachedIndex;
    try {
      // Validate the local pack index format
      const raw = localPackIndex;
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.packs)) {
        console.warn('[CodeHelper] PackManager: invalid local index format');
        return null;
      }
      this.cachedIndex = raw as unknown as PackIndex;
      return this.cachedIndex;
    } catch (err) {
      console.warn('[CodeHelper] PackManager: failed to load local index:', err);
      return null;
    }
  }

  /**
   * Get the cached index (or load if not cached).
   */
  async getIndex(): Promise<PackIndex | null> {
    if (this.cachedIndex) return this.cachedIndex;
    return this.fetchIndex();
  }

  /**
   * Install a pack: mark as installed+enabled in storage.
   * Since packs are already bundled, no download is needed.
   */
  async installPack(pack: SnippetPack): Promise<boolean> {
    try {
      await this.settingsManager.init();
      const current = this.settingsManager.current;

      const installedPacks = [...(current.features.snippets.installedPacks || [])];
      const existing = installedPacks.findIndex((p) => p.id === pack.id);
      if (existing >= 0) {
        installedPacks[existing] = { ...pack, installed: true, enabled: true };
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

      this.installedSnippetsCache.delete(pack.id);
      return true;
    } catch (err) {
      console.warn('[CodeHelper] PackManager: install failed:', err);
      return false;
    }
  }

  /**
   * Uninstall a pack: remove from storage.
   */
  async uninstallPack(packId: string): Promise<boolean> {
    try {
      await this.settingsManager.init();
      const current = this.settingsManager.current;

      const installedPacks = (current.features.snippets.installedPacks || [])
        .filter((p) => p.id !== packId);

      await this.settingsManager.update({
        features: {
          ...current.features,
          snippets: {
            ...current.features.snippets,
            installedPacks,
          },
        },
      });

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
   * Get snippets for an installed pack (from cache or re-parse).
   */
  getSnippetsForPack(pack: SnippetPack): Snippet[] {
    if (this.installedSnippetsCache.has(pack.id)) {
      return this.installedSnippetsCache.get(pack.id) || [];
    }
    return [];
  }

  /**
   * Get ALL snippets from all installed + enabled packs.
   */
  async getAllPackSnippets(): Promise<Snippet[]> {
    const packs = await this.getInstalledPacks();
    const enabledPacks = packs.filter((p) => p.enabled);
    const all: Snippet[] = [];
    for (const pack of enabledPacks) {
      const snippets = this.getSnippetsForPack(pack);
      all.push(...snippets);
    }
    return all;
  }

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
