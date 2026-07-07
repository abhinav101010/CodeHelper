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

  async init(): Promise<Settings> {
    const stored = await chrome.storage.sync.get('settings');
    this.cache = (stored.settings as Settings) ?? DEFAULT_SETTINGS;

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) {
        this.cache = changes.settings.newValue as Settings;
        this.listeners.forEach((fn) => fn(this.cache));
      }
    });

    return this.cache;
  }

  async update(partial: Partial<Settings>): Promise<void> {
    this.cache = deepMerge(this.cache, partial);
    await chrome.storage.sync.set({ settings: this.cache });
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
