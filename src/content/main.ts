// MAIN world content script — runs in the page context
// Has access to window.monaco, window.ace, etc.
// Receives settings from ISOLATED world via bridge, applies all features.

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL: Install Monaco error handlers IMMEDIATELY at module level.
// Monaco 0.55.3 (LeetCode) has internal bugs where e.text may be a
// non-string (number, undefined, etc.) causing "e.text.replaceAll is not
// a function" — crashes the suggestion pipeline.
//
// APPROACH (safe, no Object.prototype pollution):
//   Layer 0: Patch String.prototype.replaceAll to handle non-string `this`
//   Layer 1: Global error handler — silently swallows known Monaco bugs
//   Layer 2: Unhandled rejection handler
//   Layer 3: Monaco onUnexpectedError hook
//   Layer 4: No-op completion provider (pre-empts Monaco word provider)
//
// CRITICAL: We do NOT patch Object.prototype.replaceAll. Modifying
// Object.prototype — even as non-enumerable — can cause subtle breakage
// in React, Monaco, and other libraries (e.g. getOwnPropertyNames checks,
// hasOwnProperty patterns, Proxy traps). The String.prototype patch
// handles string values; global error handlers catch everything else.
// ═══════════════════════════════════════════════════════════════════════════

(function installMonacoErrorShields(): void {
  try {
    // ── Layer 0: String.prototype.replaceAll safety patch ───────────────
    // Only helps when `this` is a string. For non-string values (numbers),
    // JS never looks up String.prototype, so this patch alone is insufficient
    // for those cases — but it's safe and handles the most common path.
    if (!(String.prototype as any).__ch_patched) {
      (String.prototype as any).__ch_patched = true;
      const _origReplaceAll = String.prototype.replaceAll;
      (String.prototype as any).replaceAll = function (this: any, search: any, replace: any): string {
        const self = this;
        if (self === null || self === undefined) return '';
        if (typeof self !== 'string') {
          try { return _origReplaceAll.call(String(self), search, replace); }
          catch { return String(self); }
        }
        return _origReplaceAll.call(self, search, replace);
      };
    }

    // ── Layer 0b: String.prototype.replace safety patch ────────────────
    // Similar to above — Monaco sometimes calls .replace() on non-strings.
    if (!(String.prototype as any).__ch_replace_patched) {
      (String.prototype as any).__ch_replace_patched = true;
      const _origReplace = String.prototype.replace;
      (String.prototype as any).replace = function (this: any, search: any, replace: any): string {
        const self = this;
        if (self === null || self === undefined) return '';
        if (typeof self !== 'string') {
          try { return _origReplace.call(String(self), search, replace); }
          catch { return String(self); }
        }
        return _origReplace.call(self, search, replace);
      };
    }
  } catch { /* best-effort */ }

  // ── Layer 1: Global error event (capture phase) ─────────────────────
  // CRITICAL: Do NOT call event.preventDefault() unless we are completely
  // certain the error is benign. Calling preventDefault on React errors
  // or Monaco rendering errors can break the page entirely.
  // We ONLY suppress errors that match known Monaco internal patterns.
  const globalErrorHandler = (event: ErrorEvent) => {
    try {
      const msg = event?.error?.message ?? event?.message ?? '';
      if (typeof msg !== 'string') return;
      if (
        msg.includes('replaceAll is not a function') ||
        msg.includes("e.text.replaceAll") ||
        msg.includes('replace is not a function') ||
        msg.includes('replaceAll of undefined')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    } catch { /* ignore */ }
  };
  window.addEventListener('error', globalErrorHandler, { capture: true });

  // ── Layer 2: Unhandled promise rejections ───────────────────────────
  const rejectionHandler = (event: PromiseRejectionEvent) => {
    try {
      const msg = event?.reason?.message ?? event?.reason ?? '';
      if (typeof msg === 'string' && (
        msg.includes('replaceAll is not a function') ||
        msg.includes("e.text.replaceAll")
      )) {
        event.preventDefault();
      }
    } catch { /* ignore */ }
  };
  window.addEventListener('unhandledrejection', rejectionHandler, { capture: true });

  // Store refs for cleanup
  (window as any).__ch_monaco_error_handler = globalErrorHandler;
  (window as any).__ch_monaco_rejection_handler = rejectionHandler;

  // ── Layer 3: Monaco onUnexpectedError hook ──────────────────────────
  const tryPatchMonaco = (): void => {
    try {
      const m = (window as any).monaco;
      if (m?.editor?.onUnexpectedError) {
        if ((window as any).__ch_monaco_patched) return;
        (window as any).__ch_monaco_patched = true;
        m.editor.onUnexpectedError((err: any) => {
          const msg = err?.message ?? String(err ?? '');
          if (typeof msg === 'string' && (
            msg.includes('replaceAll is not a function') ||
            msg.includes("e.text.replaceAll")
          )) {
            return; // Swallow silently — known Monaco internal bug
          }
        });
      }
    } catch { /* ignore */ }
  };
  tryPatchMonaco();
  const pollTimer = setInterval(tryPatchMonaco, 500);
  setTimeout(() => clearInterval(pollTimer), 15000);

  // ── Layer 4: Register no-op completion provider for ALL languages ───
  // This pre-empts Monaco's built-in word-based suggestion provider
  // which is the root cause of the e.text.replaceAll crash.
  // Monaco's wildcard ('*') provider acts as a fallback, but we also
  // register for common languages explicitly to be sure.
  const registerSafeProvider = (): void => {
    try {
      const ml = (window as any).monaco?.languages;
      if (!ml?.registerCompletionItemProvider) return;
      if ((window as any).__ch_provider_registered) return;
      (window as any).__ch_provider_registered = true;
      // Register for wildcard (all languages)
      ml.registerCompletionItemProvider('*', {
        triggerCharacters: [],
        provideCompletionItems: () => ({ suggestions: [] }),
      });
      // Also register for common LeetCode languages explicitly
      // to override any language-specific providers Monaco creates.
      const langs = ['python', 'cpp', 'c', 'java', 'javascript', 'typescript',
        'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'html', 'css'];
      for (const lang of langs) {
        try {
          ml.registerCompletionItemProvider(lang, {
            triggerCharacters: [],
            provideCompletionItems: () => ({ suggestions: [] }),
          });
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  };
  registerSafeProvider();
  const providerTimer = setInterval(registerSafeProvider, 500);
  setTimeout(() => clearInterval(providerTimer), 10000);
})();

import { onMessage } from '../core/bridge';
import type { Settings } from '../types/settings';
import type { EditorAdapter } from '../adapters/types';

// Static imports for all feature engines and adapters
import { applyTheme, applyMonacoThemeEarly } from '../features/themes/engine';
import { applyFont } from '../features/fonts/engine';
import { applyLineHighlight } from '../features/line-highlight/engine';
import { applyBracketPairs } from '../features/bracket-pairs/engine';
import { applyIndentGuides } from '../features/indent-guides/engine';
import { applyCursorStyle } from '../features/cursor/engine';
import { applySelectionStyle } from '../features/selection/engine';
import { SnippetEngine } from '../features/snippets/engine';
import { AutoCloseEngine } from '../features/auto-close/engine';
import { IndentationEngine } from '../features/indentation/engine';
import { ShortcutEngine } from '../features/shortcuts/engine';
import { createMonacoAdapter } from '../adapters/monaco';

// ── Constants ──────────────────────────────────────────────────────────────

const SITE_PATTERNS: Record<string, RegExp> = {
  leetcode: /leetcode\.com/,
  codechef: /codechef\.com/,
  codeforces: /codeforces\.com/,
  hackerrank: /hackerrank\.com/,
  atcoder: /atcoder\.jp/,
  geeksforgeeks: /geeksforgeeks\.org/,
  hackerearth: /hackerearth\.com/,
};

const EDITOR_SELECTORS: Record<string, string> = {
  leetcode:
    '#editor .monaco-editor, .monaco-editor:not(.read-only) , [data-cy="code-editor"] .monaco-editor',
  codechef: '.ace_editor',
  codeforces: '.CodeMirror',
  hackerrank: '.ace_editor',
  atcoder: '.cm-editor, .CodeMirror',
  geeksforgeeks: '.ace_editor',
  hackerearth: '.CodeMirror, .cm-editor',
};

// ── State ──────────────────────────────────────────────────────────────────

let currentAdapter: EditorAdapter | null = null;
let currentSettings: Settings | null = null;
let site: string | null = null;
let activeEngines: Array<{ dispose(): void }> = [];
let lastUrl = window.location.href;
let navigationCleanupFns: Array<() => void> = [];
let isInitializing = false;

/** Set to true once init() has completed with real settings applied. */
let initialized = false;

/** Promise chain for sequential applyFeatures calls (replaces guard). */
let applyFeaturesChain: Promise<void> = Promise.resolve();

// ── Site detection ─────────────────────────────────────────────────────────

function detectSiteFromUrl(): string | null {
  const url = window.location.href;
  for (const [siteName, pattern] of Object.entries(SITE_PATTERNS)) {
    if (pattern.test(url)) return siteName;
  }
  return null;
}

// ── Autocomplete configuration ─────────────────────────────────────────────

function configureEditorAutocomplete(adapter: EditorAdapter): void {
  if (adapter.editorType === 'monaco') {
    // CRITICAL: USE BOOLEAN false, NOT string 'off'!
    // Monaco expects boolean for quickSuggestions sub-options.
    // The string 'off' is truthy in JS, so passing it means
    // Monaco's native suggestions are STILL ACTIVE.
    // When Monaco's suggestion engine runs alongside our custom
    // widget, it encounters non-string values in the completion
    // pipeline and crashes with "e.text.replaceAll is not a function".
    // This corrupts ALL autocomplete for the entire browsing session.
    // Using proper boolean false truly disables Monaco's native suggest.
    adapter.updateOptions({
      quickSuggestions: { other: false, comments: false, strings: false },
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnEnter: 'off',
      // tabCompletion accepts 'on' | 'off' | 'onlySnippets' — string is correct
      tabCompletion: 'off',
      // wordBasedSuggestions accepts 'off' | 'currentDocument' | etc — string is correct
      wordBasedSuggestions: 'off',
      parameterHints: { enabled: false },
      suggest: {
        showKeywords: false,
        showSnippets: false,
        showWords: false,
        insertMode: 'insert',
        preview: false,
      },
      bracketPairColorization: {
        enabled: true,
        independentColorPoolPerBracketType: true,
      },
    });
    console.log('[CodeHelper] MAIN: Monaco autocomplete configured (native fully disabled)');
    return;
  }

  if (adapter.editorType === 'ace') {
    adapter.updateOptions({
      enableAutoInsert: true,
      enableLiveAutocompletion: true,
      enableSnippets: true,
    });
  }
}

// ── Editor wait helpers ────────────────────────────────────────────────────

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

/**
 * Wait for Monaco global API to be available and return the EDITABLE code editor.
 * LeetCode has multiple Monaco editors (problem description is read-only, code editor is editable).
 */
function waitForMonacoEditor(timeout = 15000): Promise<any> {
  return new Promise((resolve, reject) => {
    function findEditableEditor(): any {
      const m = (window as any).monaco;
      if (!m?.editor) return null;

      const editors = m.editor.getEditors?.();
      if (!editors || editors.length === 0) return null;

      // Try getRawOptions first (most reliable)
      for (const editor of editors) {
        try {
          const rawOpts = editor.getRawOptions?.();
          if (rawOpts && typeof rawOpts.readOnly === 'boolean' && !rawOpts.readOnly) {
            return editor;
          }
        } catch {
          // skip
        }
      }

      // Fallback: getOption(EditorOption.readOnly) — often 89
      for (const editor of editors) {
        try {
          if (editor.getOption?.(89) === false) return editor;
        } catch {
          // skip
        }
      }

      // Last resort: editor with model content that's non-empty
      for (const editor of editors) {
        try {
          const model = editor.getModel?.();
          if (model && typeof model.getValue === 'function' && model.getValue().length > 0) {
            return editor;
          }
        } catch {
          // skip
        }
      }

      // Absolute fallback: last editor (usually the code editor on LeetCode)
      return editors[editors.length - 1];
    }

    // Try immediately
    const editor = findEditableEditor();
    if (editor) {
      resolve(editor);
      return;
    }

    // Poll every 300ms
    const interval = setInterval(() => {
      const editor = findEditableEditor();
      if (editor) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve(editor);
      }
    }, 300);

    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Monaco editor not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Quick one-shot SETTINGS_REQUEST to ISOLATED world.
 * Uses direct postMessage with a single 800ms timeout instead of
 * the bridge's retry chain (3 retries × 2s = 10s worst case).
 */
function quickRequestFromIsolated(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestId = 'qr_' + String(Math.random()).slice(2);
    const handler = (event: MessageEvent) => {
      if (
        event.data?.namespace === '__CH_BRIDGE__' &&
        event.data?.type === 'RESPONSE' &&
        event.data?.requestId === requestId
      ) {
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        resolve(event.data.payload);
      }
    };
    window.addEventListener('message', handler);

    window.postMessage({
      namespace: '__CH_BRIDGE__',
      type: 'SETTINGS_REQUEST',
      payload: {},
      requestId,
      source: 'main',
    }, '*');

    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Quick settings request timed out'));
    }, 800);
  });
}

// ── Feature application ────────────────────────────────────────────────────

async function applyFeatures(adapter: EditorAdapter, settings: Settings): Promise<void> {
  await applyFeaturesChain;
  applyFeaturesChain = (async () => {
    try {
      // Dispose previous engines
      for (const e of activeEngines) {
        try { e.dispose(); } catch { /* ignore */ }
      }
      activeEngines = [];

      // Remove old managed styles
      document.querySelectorAll('style[data-ch-managed]').forEach((el) => el.remove());

      console.log('[CodeHelper] MAIN: applying features');

      // 1. Configure autocomplete first
      configureEditorAutocomplete(adapter);

      // 2. Theme
      if (settings.theme) {
        try { applyTheme(settings.theme.name, adapter); } catch (e) { console.warn('[CodeHelper] Failed to apply theme:', e); }
      }

      // 3. Font
      if (settings.font) {
        try { applyFont(settings.font, adapter); } catch (e) { console.warn('[CodeHelper] Failed to apply font:', e); }
      }

      // 4. Visual enhancements
      if (settings.features.lineHighlight?.enabled) {
        try { applyLineHighlight(adapter, settings.features.lineHighlight); } catch (e) { console.warn('[CodeHelper] Failed to apply line highlight:', e); }
      }
      if (settings.features.bracketPairs?.enabled) {
        try { applyBracketPairs(adapter); } catch (e) { console.warn('[CodeHelper] Failed to apply bracket pairs:', e); }
      }
      if (settings.features.indentGuides?.enabled) {
        try { applyIndentGuides(adapter, settings.features.indentGuides); } catch (e) { console.warn('[CodeHelper] Failed to apply indent guides:', e); }
      }
      if (settings.features.cursor?.enabled) {
        try { applyCursorStyle(adapter, settings.features.cursor); } catch (e) { console.warn('[CodeHelper] Failed to apply cursor style:', e); }
      }
      if (settings.features.selection?.enabled) {
        try { applySelectionStyle(adapter, settings.features.selection); } catch (e) { console.warn('[CodeHelper] Failed to apply selection style:', e); }
      }

      // 5. Interactive features
      if (settings.features.snippets?.enabled) {
        try { activeEngines.push(new SnippetEngine(adapter, settings.features.snippets)); } catch (e) { console.warn('[CodeHelper] Failed to apply snippets:', e); }
      }
      if (settings.features.autoClose?.enabled) {
        try { activeEngines.push(new AutoCloseEngine(adapter, settings.features.autoClose)); } catch (e) { console.warn('[CodeHelper] Failed to apply auto-close:', e); }
      }
      if (settings.features.indentation?.enabled) {
        try { activeEngines.push(new IndentationEngine(adapter, settings.features.indentation)); } catch (e) { console.warn('[CodeHelper] Failed to apply indentation:', e); }
      }
      if (settings.features.shortcuts?.enabled) {
        try { activeEngines.push(new ShortcutEngine(adapter, settings.features.shortcuts)); } catch (e) { console.warn('[CodeHelper] Failed to apply shortcuts:', e); }
      }

      console.log('[CodeHelper] MAIN: features applied');
    } catch (err) {
      console.warn('[CodeHelper] applyFeatures threw:', err);
    }
  })();
  await applyFeaturesChain;
}

// ── Snippet CSS injection ──────────────────────────────────────────────────

function injectSnippetStyles(): void {
  // Skip if already injected
  if (document.querySelector('style[data-ch-snippet-styles]')) return;

  const style = document.createElement('style');
  style.setAttribute('data-ch-managed', '');
  style.setAttribute('data-ch-snippet-styles', '');
  style.textContent =
    '.ch-snippet-placeholder{background-color:rgba(255,200,0,0.1);border-radius:3px;box-shadow:0 0 0 1px rgba(255,200,0,0.15)}' +
    '.ch-snippet-placeholder-active{background-color:rgba(255,200,0,0.22);border-radius:3px;box-shadow:0 0 0 1px rgba(255,200,0,0.45)}' +
    '.ch-snippet-placeholder-active{position:relative}' +
        '.ch-snippet-placeholder-active::after{content:"";position:absolute;inset:0;animation:ch-blink 1s step-end infinite;pointer-events:none}' +
    '@keyframes ch-blink{50%{opacity:0}}';
  document.head?.appendChild(style);
}

// ── Monaco error swallowing ────────────────────────────────────────────────

/**
 * Monaco 0.55.3 (LeetCode) has internal bugs that crash the suggestion pipeline.
 * This installs MULTIPLE layers of error swallowing:
 * 1. Monaco's own onUnexpectedError hook
 * 2. Global window 'error' event (capture phase) — catches Monaco's thrown errors
 *    that bypass onUnexpectedError (e.g. errors in computed properties that
 *    cascade into unrelated event handlers)
 * 3. Global unhandledrejection — catches async errors
 *
 * This layered approach ensures that Monaco's internal bugs (replaceAll,
 * replace, etc.) never bubble up to break the editor or the extension.
 */




// ── Re-initialization ──────────────────────────────────────────────────────

async function reinitialize(): Promise<void> {
  console.log('[CodeHelper] MAIN: reinitializing due to navigation');

  // Prevent concurrent reinitializations
  if (isInitializing) {
    console.log('[CodeHelper] MAIN: already initializing, skipping reinit');
    return;
  }

  initialized = false;

  // Dispose current adapter and engines
  for (const e of activeEngines) {
    try {
      e.dispose();
    } catch {
      /* ignore */
    }
  }
  activeEngines = [];
  currentAdapter?.dispose();
  currentAdapter = null;

  // Remove managed styles
  document.querySelectorAll('style[data-ch-managed]').forEach((el) => el.remove());

  // Global error handlers are installed at module level (IIFE) and persist.
  // Do NOT remove them — they protect against Monaco 0.55.3 internal bugs.

  // Clean up old navigation observers
  for (const fn of navigationCleanupFns) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  navigationCleanupFns = [];

  // Wait for DOM to settle — LeetCode SPA navigation may need time
  // for old editor instances to be removed and new ones created.
  await new Promise((r) => setTimeout(r, 300));

  await init();

  // Re-setup navigation observer for the new lifecycle
  setupNavigationObserver();
}

// ── Settings (defaults when isolated world not reachable) ───────────────────

function defaultSettings(): Settings {
  return {
    enabled: true,
    perSite: {
      leetcode: true,
      codechef: true,
      codeforces: true,
      hackerrank: true,
      atcoder: true,
      geeksforgeeks: true,
      hackerearth: true,
    },
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

// ── Init ───────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  if (isInitializing) {
    console.log('[CodeHelper] MAIN: already initializing, skipping');
    return;
  }
  isInitializing = true;

  try {
    console.log('[CodeHelper] MAIN: init');
    site = detectSiteFromUrl();
    if (!site) {
      console.log('[CodeHelper] MAIN: not a supported site');
      return;
    }
    console.log('[CodeHelper] MAIN: detected site:', site);

    // ── Create adapter ──────────────────────────────────────────────────

    if (site === 'leetcode') {
      // Apply theme EARLY — define+set as soon as window.monaco.editor
      // is available, without waiting for a specific editor instance.
      // This prevents the visible "flash" of default theme before ours applies.
      const themeName = currentSettings?.theme?.name ?? 'vscode-dark';
      if (!applyMonacoThemeEarly(themeName)) {
        // Monaco not ready yet; poll until it is
        const themeTimer = setInterval(() => {
          if (applyMonacoThemeEarly(themeName)) {
            clearInterval(themeTimer);
          }
        }, 200);
        // Safety cleanup after 10s
        setTimeout(() => clearInterval(themeTimer), 10000);
      }

      // Inject snippet styles early (before adapter is needed)
      injectSnippetStyles();

      // For LeetCode, wait for Monaco to be ready before creating the adapter
      console.log('[CodeHelper] MAIN: waiting for Monaco editor');
      const editor = await waitForMonacoEditor();
      console.log('[CodeHelper] MAIN: Monaco editor found');

      // CRITICAL: Configure the editor IMMEDIATELY before any suggest pipeline
      // can activate. Monaco's built-in word-based suggestion provider has a
      // bug where e.text.replaceAll crashes on non-string values.
      // By disabling Monaco's native suggestions NOW, we prevent the crash
      // before it happens, instead of catching it after the fact.
      try {
        editor.updateOptions({
          quickSuggestions: { other: false, comments: false, strings: false },
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          wordBasedSuggestions: 'off',
          parameterHints: { enabled: false },
          suggest: {
            showKeywords: false,
            showSnippets: false,
            showWords: false,
            insertMode: 'insert',
            preview: false,
          },
        });
        console.log('[CodeHelper] MAIN: Monaco native suggestions disabled immediately on editor found');
      } catch (e) {
        console.warn('[CodeHelper] MAIN: failed to configure editor immediately:', e);
      }

      // Create adapter with the raw editor instance directly
      const adapter = createMonacoAdapter(editor);
      if (!adapter) {
        console.warn('[CodeHelper] MAIN: could not create Monaco adapter');
        return;
      }
      currentAdapter = adapter;
      console.log('[CodeHelper] MAIN: adapter created: monaco');
    } else {
      // For other sites, use DOM-based detection
      const selector = EDITOR_SELECTORS[site];
      console.log('[CodeHelper] MAIN: looking for editor with selector:', selector);
      const container = await waitForEditor(selector);
      console.log('[CodeHelper] MAIN: editor container found');

      // Import dynamically to avoid loading all adapters upfront
      const { detectEditor } = await import('../adapters');
      currentAdapter = detectEditor(container);
      if (!currentAdapter) {
        console.warn('[CodeHelper] MAIN: could not detect editor on', site);
        return;
      }
      console.log('[CodeHelper] MAIN: adapter created:', currentAdapter.editorType);

      // Inject snippet styles
      injectSnippetStyles();
    }

    // ── Use defaults immediately (don't block on ISOLATED) ──────────────
    // Settings are pushed from ISOLATED via SETTINGS_UPDATE at module level.
    // Using defaults immediately avoids the 2-22s delay that breaks the UX.

    if (!currentSettings) {
      currentSettings = defaultSettings();
    }

    // ── Apply all features with defaults ─────────────────────────────

    await applyFeatures(currentAdapter, currentSettings);

    // ── Quick settings request from ISOLATED (single attempt, short timeout) ─
    // Use direct postMessage+Promise instead of bridge retry chain,
    // because the bridge's 3 retries × 2s timeout = 10s worst case.
    // We already have defaults applied, so failing fast is better.
    try {
      const settingsResponse = await quickRequestFromIsolated();
      if (settingsResponse && !(settingsResponse as any)?.__fallback) {
        console.log('[CodeHelper] MAIN: received settings via quick request');
        currentSettings = settingsResponse as Settings;
        if (currentAdapter && currentSettings) {
          await applyFeatures(currentAdapter, currentSettings);
        }
      }
    } catch {
      // ISOLATED not ready yet — fall back to defaults
      console.log('[CodeHelper] MAIN: quick request failed, using defaults');
    }

    console.log('[CodeHelper] MAIN: initialization complete');
    initialized = true;
  } catch (error) {
    console.warn('[CodeHelper] MAIN: editor not found on', site, error);
  } finally {
    isInitializing = false;
  }
}

// ── Settings update listener (registered at MODULE level) ─────────────────
// This ensures we're ready to receive settings BEFORE init() starts waiting
// for the editor. ISOLATED pushes settings immediately on load.

onMessage(async (type, payload, respond) => {
  if (type === 'SETTINGS_UPDATE') {
    console.log('[CodeHelper] MAIN: received settings update from ISOLATED');
    currentSettings = payload as Settings;

    // Don't re-apply features during initial init() — init() handles it
    if (initialized && currentAdapter && currentSettings) {
      await applyFeatures(currentAdapter, currentSettings);
    }

    respond?.({ received: true });
  }
});

// ── SPA Navigation Observer ────────────────────────────────────────────────

function setupNavigationObserver(): void {
  // Initialize lastUrl to prevent false reinit on first check
  lastUrl = window.location.href;

  // 1. URL polling (catches hash changes, SPA routing)
  // Use a small debounce (500ms) so quick URL changes don't trigger
  // multiple reinitializations.
  let reinitTimer: number | null = null;
  const urlCheckInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (reinitTimer === null) {
        reinitTimer = window.setTimeout(() => {
          reinitTimer = null;
          console.log('[CodeHelper] MAIN: URL changed, reinitializing');
          reinitialize();
        }, 500);
      }
    }
  }, 1000);
  navigationCleanupFns.push(() => {
    clearInterval(urlCheckInterval);
    if (reinitTimer !== null) { clearTimeout(reinitTimer); reinitTimer = null; }
  });
  // 2. popstate (back/forward buttons)
  const onPopState = () => {
    console.log('[CodeHelper] MAIN: popstate detected, reinitializing');
    lastUrl = window.location.href;
    if (reinitTimer === null) {
      reinitTimer = window.setTimeout(() => {
        reinitTimer = null;
        reinitialize();
      }, 500);
    }
  };
  window.addEventListener('popstate', onPopState);
  navigationCleanupFns.push(() => window.removeEventListener('popstate', onPopState));

  // 3. Override pushState/replaceState
  const originalPushState = history.pushState.bind(history);
  history.pushState = ((data: any, unused: string, url?: string | URL | null) => {
    originalPushState(data, unused, url);
    setTimeout(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (reinitTimer === null) {
          reinitTimer = window.setTimeout(() => {
            reinitTimer = null;
            console.log('[CodeHelper] MAIN: pushState navigation, reinitializing');
            reinitialize();
          }, 500);
        }
      }
    }, 0);
  }) as typeof history.pushState;
  navigationCleanupFns.push(() => {
    history.pushState = originalPushState;
  });

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = ((data: any, unused: string, url?: string | URL | null) => {
    originalReplaceState(data, unused, url);
    setTimeout(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (reinitTimer === null) {
          reinitTimer = window.setTimeout(() => {
            reinitTimer = null;
            console.log('[CodeHelper] MAIN: replaceState navigation, reinitializing');
            reinitialize();
          }, 500);
        }
      }
    }, 0);
  }) as typeof history.replaceState;
  navigationCleanupFns.push(() => {
    history.replaceState = originalReplaceState;
  });

  // 4. For LeetCode, periodically check that adapter still has a valid editor
  if (site === 'leetcode') {
    const editorCheckInterval = setInterval(() => {
      if (!currentAdapter) return;
      try {
        const m = (window as any).monaco?.editor;
        if (!m) return;
        const editors = m.getEditors?.();
        if (!editors || editors.length === 0) {
          // Editor lost — reinitialize
          console.log('[CodeHelper] MAIN: editor instances lost, reinitializing');
          reinitialize();
        }
      } catch {
        // ignore
      }
    }, 3000);
    navigationCleanupFns.push(() => clearInterval(editorCheckInterval));
  }
}

// ── Extension context health check ───────────────────────────────────────
// Periodically check if the extension context is still valid.
// If invalidated, stop all activity to prevent spurious errors.

function startContextHealthCheck(): void {
  const checkInterval = setInterval(() => {
    try {
      const valid = !!(chrome?.runtime?.id);
      if (!valid) {
        clearInterval(checkInterval);
        console.warn('[CodeHelper] MAIN: Extension context invalidated. Stopping.');
        // Dispose everything cleanly
        for (const e of activeEngines) {
          try { e.dispose(); } catch { /* ignore */ }
        }
        activeEngines = [];
        currentAdapter?.dispose();
        currentAdapter = null;
        initialized = false;
      }
    } catch {
      clearInterval(checkInterval);
      console.warn('[CodeHelper] MAIN: Extension context access error.');
    }
  }, 10000); // Every 10 seconds
  navigationCleanupFns.push(() => clearInterval(checkInterval));
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

function bootstrap(): void {
  init();
  setupNavigationObserver();
  startContextHealthCheck();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
