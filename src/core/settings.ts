import { DEFAULT_SETTINGS } from '../types/settings';
import type { Settings } from '../types/settings';

type SettingsListener = (settings: Settings) => void;

function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        result[key],
        source[key] as Partial<(T & Record<string, unknown>)[Extract<keyof T, string>]>,
      );
    } else if (source[key] !== undefined) {
      (result as Record<string, unknown>)[key] = source[key];
    }
  }
  return result;
}

export class SettingsManager {
  private cache: Settings = DEFAULT_SETTINGS;
  private listeners: Set<SettingsListener> = new Set();
  private storageListenerAdded = false;

  async init(): Promise<Settings> {
    // Guard against extension context invalidation
    if (!this.isContextValid()) {
      this.cache = DEFAULT_SETTINGS;
      return this.cache;
    }

    try {
      const stored = await chrome.storage.sync.get('settings');
      this.cache = (stored.settings as Settings) ?? DEFAULT_SETTINGS;
    } catch (err) {
      console.warn('[CodeHelper] SettingsManager.init: chrome.storage failed:', err);
      this.cache = DEFAULT_SETTINGS;
      return this.cache;
    }

    // Only register the storage listener once across all init() calls
    if (!this.storageListenerAdded) {
      try {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync' && changes.settings) {
            this.cache = changes.settings.newValue as Settings;
            this.listeners.forEach((fn) => fn(this.cache));
          }
        });
        this.storageListenerAdded = true;
      } catch {
        // Context may be invalidated
      }
    }

    return this.cache;
  }

  private isContextValid(): boolean {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime) return false;
      const id = chrome.runtime.id;
      return !!id;
    } catch {
      return false;
    }
  }

  async update(partial: Partial<Settings>): Promise<void> {
    this.cache = deepMerge(this.cache, partial);
    if (this.isContextValid()) {
      try {
        await chrome.storage.sync.set({ settings: this.cache });
      } catch {
        // Context may be invalidated
      }
    }
  }

  subscribe(fn: SettingsListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get current(): Settings {
    return this.cache;
  }
}

export const settingsManager = new SettingsManager();
