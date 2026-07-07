// MAIN world content script — runs in the page context
// Has access to window.monaco, window.ace, etc.
// Receives settings from ISOLATED world via bridge, applies all features.

import { onMessage, sendToIsolated } from '../core/bridge';
import { detectEditor } from '../adapters';
import type { Settings } from '../types/settings';
import type { EditorAdapter } from '../adapters/types';

// Site detection patterns
const SITE_PATTERNS: Record<string, RegExp> = {
  leetcode: /leetcode\.com/,
  codechef: /codechef\.com/,
  codeforces: /codeforces\.com/,
  hackerrank: /hackerrank\.com/,
  atcoder: /atcoder\.jp/,
  geeksforgeeks: /geeksforgeeks\.org/,
  hackerearth: /hackerearth\.com/,
};

// Editor detection selectors per site
const EDITOR_SELECTORS: Record<string, string> = {
  // LeetCode has multiple .monaco-editor elements (problem description + code editor).
  // Target the code editor specifically: it's inside the coding area container.
  leetcode:
    '#editor .monaco-editor, .monaco-editor:not(.read-only) , [data-cy="code-editor"] .monaco-editor',
  codechef: '.ace_editor',
  codeforces: '.CodeMirror',
  hackerrank: '.ace_editor',
  atcoder: '.cm-editor, .CodeMirror',
  geeksforgeeks: '.ace_editor',
  hackerearth: '.CodeMirror, .cm-editor',
};

let currentAdapter: EditorAdapter | null = null;
let currentSettings: Settings | null = null;
let site: string | null = null;
let activeEngines: Array<{ dispose(): void }> = [];

function detectSiteFromUrl(): string | null {
  const url = window.location.href;
  for (const [siteName, pattern] of Object.entries(SITE_PATTERNS)) {
    if (pattern.test(url)) return siteName;
  }
  return null;
}

function configureEditorAutocomplete(adapter: EditorAdapter): void {
  if (adapter.editorType === 'monaco') {
    adapter.updateOptions({
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      suggestOnTriggerCharacters: true,
      // Enable word-based suggestions since the extension doesn't register a
      // custom CompletionItemProvider — without this no suggestions appear at all.
      wordBasedSuggestions: 'currentDomain',
    });
  } else if (adapter.editorType === 'ace') {
    adapter.updateOptions({
      enableAutoInsert: true,
      enableLiveAutocompletion: true,
      enableSnippets: true,
    });
  }
}

function waitForEditor(selector: string, timeout = 15000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector) as HTMLElement;
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector) as HTMLElement;
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Editor not found within ${timeout}ms`));
    }, timeout);
  });
}

async function applyFeatures(adapter: EditorAdapter, settings: Settings): Promise<void> {
  // Dispose previous engines to avoid duplicates
  activeEngines.forEach((e) => {
    try {
      e.dispose();
    } catch {
      /* ignore */
    }
  });
  activeEngines = [];

  // Remove old injected styles for clean re-application
  document.querySelectorAll('style[data-ch-managed]').forEach((el) => el.remove());
  console.log('[CodeHelper] MAIN: applying features');

  // Apply themes
  if (settings.theme) {
    try {
      const { applyTheme } = await import('../features/themes/engine');
      applyTheme(settings.theme.name, adapter);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply theme:', e);
    }
  }

  // Apply fonts
  if (settings.font) {
    try {
      const { applyFont } = await import('../features/fonts/engine');
      applyFont(settings.font);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply font:', e);
    }
  }

  // Configure editor autocomplete/suggestions (re-applied on every feature update)
  configureEditorAutocomplete(adapter);

  // Apply visual enhancements
  if (settings.features.lineHighlight?.enabled) {
    try {
      const { applyLineHighlight } = await import('../features/line-highlight/engine');
      applyLineHighlight(adapter, settings.features.lineHighlight);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply line highlight:', e);
    }
  }

  if (settings.features.bracketPairs?.enabled) {
    try {
      const { applyBracketPairs } = await import('../features/bracket-pairs/engine');
      applyBracketPairs(adapter);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply bracket pairs:', e);
    }
  }

  if (settings.features.indentGuides?.enabled) {
    try {
      const { applyIndentGuides } = await import('../features/indent-guides/engine');
      applyIndentGuides(adapter, settings.features.indentGuides);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply indent guides:', e);
    }
  }

  if (settings.features.cursor?.enabled) {
    try {
      const { applyCursorStyle } = await import('../features/cursor/engine');
      applyCursorStyle(adapter, settings.features.cursor);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply cursor style:', e);
    }
  }

  if (settings.features.selection?.enabled) {
    try {
      const { applySelectionStyle } = await import('../features/selection/engine');
      applySelectionStyle(adapter, settings.features.selection);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply selection style:', e);
    }
  }

  // Apply interactive features
  if (settings.features.snippets?.enabled) {
    try {
      const { SnippetEngine } = await import('../features/snippets/engine');
      activeEngines.push(new SnippetEngine(adapter, settings.features.snippets));
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply snippets:', e);
    }
  }

  if (settings.features.autoClose?.enabled) {
    try {
      const { AutoCloseEngine } = await import('../features/auto-close/engine');
      activeEngines.push(new AutoCloseEngine(adapter, settings.features.autoClose));
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply auto-close:', e);
    }
  }

  if (settings.features.indentation?.enabled) {
    try {
      const { IndentationEngine } = await import('../features/indentation/engine');
      activeEngines.push(new IndentationEngine(adapter, settings.features.indentation));
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply indentation:', e);
    }
  }

  if (settings.features.shortcuts?.enabled) {
    try {
      const { ShortcutEngine } = await import('../features/shortcuts/engine');
      activeEngines.push(new ShortcutEngine(adapter, settings.features.shortcuts));
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply shortcuts:', e);
    }
  }

  console.log('[CodeHelper] MAIN: features applied');
}

async function init(): Promise<void> {
  console.log('[CodeHelper] MAIN: init');
  site = detectSiteFromUrl();
  if (!site) {
    console.log('[CodeHelper] MAIN: not a supported site');
    return;
  }
  console.log('[CodeHelper] MAIN: detected site:', site);

  // Wait for editor to appear
  const selector = EDITOR_SELECTORS[site];
  console.log('[CodeHelper] MAIN: looking for editor with selector:', selector);

  try {
    const container = await waitForEditor(selector);
    console.log('[CodeHelper] MAIN: editor container found');

    // Detect and create editor adapter
    currentAdapter = detectEditor(container);
    if (!currentAdapter) {
      console.warn('[CodeHelper] MAIN: could not detect editor on', site);
      return;
    }
    console.log('[CodeHelper] MAIN: adapter created:', currentAdapter.editorType);

    // Configure editor for autocomplete on type
    configureEditorAutocomplete(currentAdapter);

    // Request settings from ISOLATED world
    try {
      const settingsResponse = await sendToIsolated('SETTINGS_REQUEST', {});
      currentSettings = settingsResponse as Settings;
      console.log('[CodeHelper] MAIN: received settings from ISOLATED');
    } catch {
      console.warn('[CodeHelper] MAIN: could not get settings from ISOLATED, using defaults');
      // Use default settings if bridge fails
      currentSettings = {
        enabled: true,
        perSite: { leetcode: true },
        theme: { name: 'vscode-dark' },
        font: {
          family: 'JetBrains Mono',
          size: 14,
          lineHeight: 1.5,
          letterSpacing: 0,
          ligatures: true,
        },
        features: {
          snippets: { enabled: true, customSnippets: [] },
          autoClose: {
            enabled: true,
            pairs: { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' },
          },
          indentation: { enabled: true },
          lineHighlight: { enabled: true, color: '#2a2d2e', opacity: 0.5 },
          bracketPairs: { enabled: true },
          indentGuides: { enabled: true, color: '#404040' },
          cursor: { enabled: true, width: 2, color: '#aeafad', blinkStyle: 'smooth' },
          selection: { enabled: true, backgroundColor: '#264f78', foregroundColor: '#ffffff' },
          shortcuts: { enabled: true, mappings: {} },
        },
      };
    }

    // Apply features (includes editor autocomplete/suggestion configuration)
    await applyFeatures(currentAdapter, currentSettings);

    console.log('[CodeHelper] MAIN: initialization complete');
  } catch (error) {
    console.warn('[CodeHelper] MAIN: editor not found on', site, error);
  }
}

// Listen for settings updates from ISOLATED world
onMessage(async (type, payload, respond) => {
  if (type === 'SETTINGS_UPDATE') {
    console.log('[CodeHelper] MAIN: received settings update from ISOLATED');
    currentSettings = payload as Settings;

    if (currentAdapter && currentSettings) {
      await applyFeatures(currentAdapter, currentSettings);
    }

    respond?.({ received: true });
  }
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
