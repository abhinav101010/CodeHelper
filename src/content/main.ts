// MAIN world content script — runs in the page context
// Has access to window.monaco, window.ace, etc.
// Receives settings from ISOLATED world via bridge, applies all features.

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
let isApplyingFeatures = false;

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
    adapter.updateOptions({
      // DISABLE Monaco's native quick suggestions entirely.
      // Our custom SnippetSuggestWidget is the ONLY suggestion source.
      // Monaco's native suggest widget competes with ours and causes
      // two overlapping dropdowns. Disable it so only our VS Code-like
      // widget appears.
      quickSuggestions: { other: 'off', comments: 'off', strings: 'off' },
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnEnter: 'on',
      // CRITICAL: Set tabCompletion to 'off' instead of 'on'.
      // Monaco 0.55.3 (LeetCode's build) has a bug where the suggestion
      // pipeline calls .replaceAll() on a non-string value, which crashes
      // ALL autocomplete after the first Tab-accepted suggestion.
      // We handle Tab expansion ourselves via DOM capture handler.
      tabCompletion: 'off',
      wordBasedSuggestions: 'off',
      parameterHints: { enabled: false },
      suggest: {
        showKeywords: false,
        // CRITICAL: Do NOT set showSnippets to true.
        // Same bug as above — Monaco 0.55.3 crashes when processing snippet items.
        showSnippets: false,
        showWords: false,
        insertMode: 'insert',
        // preview causes Monaco to render suggestion text through its
        // internal escape/replace pipeline which can also trigger the bug.
        preview: false,
      },
      bracketPairColorization: {
        enabled: true,
        independentColorPoolPerBracketType: true,
      },
    });
    console.log('[CodeHelper] MAIN: Monaco autocomplete configured');
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

// ── Feature application ────────────────────────────────────────────────────

async function applyFeatures(adapter: EditorAdapter, settings: Settings): Promise<void> {
  // Guard against concurrent invocations
  if (isApplyingFeatures) {
    console.log('[CodeHelper] MAIN: already applying features, skipping');
    return;
  }
  isApplyingFeatures = true;
  try {
    // Dispose previous engines
    for (const e of activeEngines) {
      try {
        e.dispose();
      } catch {
        /* ignore */
      }
    }
    activeEngines = [];

  // Remove old managed styles
  document.querySelectorAll('style[data-ch-managed]').forEach((el) => el.remove());

  console.log('[CodeHelper] MAIN: applying features');

  // 1. Configure autocomplete first (suggestion options must be in place)
  configureEditorAutocomplete(adapter);

  // 2. Theme — re-applies the theme in case settings changed,
  // or as the initial apply when settings arrive from ISOLATED.
  // The early theme call (in init()) already set the Monaco theme,
  // so this is safe to call again.
  if (settings.theme) {
    try {
      applyTheme(settings.theme.name, adapter);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply theme:', e);
    }
  }

  // 3. Font
  if (settings.font) {
    try {
      applyFont(settings.font, adapter);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply font:', e);
    }
  }

  // 4. Visual enhancements
  if (settings.features.lineHighlight?.enabled) {
    try {
      applyLineHighlight(adapter, settings.features.lineHighlight);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply line highlight:', e);
    }
  }

  if (settings.features.bracketPairs?.enabled) {
    try {
      applyBracketPairs(adapter);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply bracket pairs:', e);
    }
  }

  if (settings.features.indentGuides?.enabled) {
    try {
      applyIndentGuides(adapter, settings.features.indentGuides);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply indent guides:', e);
    }
  }

  if (settings.features.cursor?.enabled) {
    try {
      applyCursorStyle(adapter, settings.features.cursor);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply cursor style:', e);
    }
  }

  if (settings.features.selection?.enabled) {
    try {
      applySelectionStyle(adapter, settings.features.selection);
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply selection style:', e);
    }
  }

  // 5. Interactive features (snippets before indentation so Tab-expansion takes priority)
  if (settings.features.snippets?.enabled) {
    try {
      activeEngines.push(new SnippetEngine(adapter, settings.features.snippets));
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply snippets:', e);
    }
  }

  if (settings.features.autoClose?.enabled) {
    try {
      activeEngines.push(new AutoCloseEngine(adapter, settings.features.autoClose));
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply auto-close:', e);
    }
  }

  if (settings.features.indentation?.enabled) {
    try {
      activeEngines.push(new IndentationEngine(adapter, settings.features.indentation));
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply indentation:', e);
    }
  }

  if (settings.features.shortcuts?.enabled) {
    try {
      activeEngines.push(new ShortcutEngine(adapter, settings.features.shortcuts));
    } catch (e) {
      console.warn('[CodeHelper] Failed to apply shortcuts:', e);
    }
  }

  console.log('[CodeHelper] MAIN: features applied');
  } finally {
    isApplyingFeatures = false;
  }
}

// ── Snippet CSS injection ──────────────────────────────────────────────────

function injectSnippetStyles(): void {
  const style = document.createElement('style');
  style.setAttribute('data-ch-managed', '');
  style.textContent =
    '.ch-snippet-placeholder{background-color:rgba(255,200,0,0.1);border-radius:3px;box-shadow:0 0 0 1px rgba(255,200,0,0.15)}' +
    '.ch-snippet-placeholder-active{background-color:rgba(255,200,0,0.22);border-radius:3px;box-shadow:0 0 0 1px rgba(255,200,0,0.45)}';
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
function setupMonacoErrorHandler(): void {
  // Layer 1: Monaco's onUnexpectedError
  try {
    const m = (window as any).monaco;
    if (m?.editor?.onUnexpectedError) {
      m.editor.onUnexpectedError((err: any) => {
        if (isMonacoInternalBug(err)) return; // Swallow silently
        console.warn('[CodeHelper] Monaco unexpected error:', err);
      });
    }
  } catch {
    // ignore
  }

  // Layer 2: Global error event (capture phase)
  // This catches errors thrown by Monaco that bypass onUnexpectedError,
  // such as cascading computed-property failures.
  try {
    const globalHandler = (event: ErrorEvent) => {
      if (isMonacoInternalBug(event.error ?? event.message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('error', globalHandler, { capture: true });
    // Store reference so we can remove it on reinit
    (window as any).__ch_monaco_error_handler = globalHandler;
  } catch {
    // ignore
  }

  // Layer 3: Unhandled promise rejections (async Monaco errors)
  try {
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      if (isMonacoInternalBug(event.reason)) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', rejectionHandler, { capture: true });
    (window as any).__ch_monaco_rejection_handler = rejectionHandler;
  } catch {
    // ignore
  }
}

/** Check if an error is one of Monaco 0.55.3's known internal bugs. */
function isMonacoInternalBug(err: any): boolean {
  if (!err) return false;
  const msg =
    typeof err === 'string'
      ? err
      : err.message ?? err.toString?.() ?? '';
  if (typeof msg !== 'string') return false;
  return (
    msg.includes('replaceAll is not a function') ||
    msg.includes('replace is not a function') ||
    msg.includes('Cannot read properties of undefined') ||
    msg.includes('Cannot read properties of null') ||
    msg.includes('e.text.replaceAll') ||
    msg.includes('Extension context invalidated')
  );
}

// ── Re-initialization ──────────────────────────────────────────────────────

async function reinitialize(): Promise<void> {
  console.log('[CodeHelper] MAIN: reinitializing due to navigation');

  // Prevent concurrent reinitializations
  if (isInitializing) {
    console.log('[CodeHelper] MAIN: already initializing, skipping reinit');
    return;
  }

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

  // Remove global Monaco error handlers
  try {
    const h = (window as any).__ch_monaco_error_handler;
    if (h) window.removeEventListener('error', h, { capture: true });
  } catch { /* ignore */ }
  try {
    const h = (window as any).__ch_monaco_rejection_handler;
    if (h) window.removeEventListener('unhandledrejection', h, { capture: true });
  } catch { /* ignore */ }

  // Clean up old navigation observers
  for (const fn of navigationCleanupFns) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  navigationCleanupFns = [];

  // Wait a tick for DOM to settle
  await new Promise((r) => setTimeout(r, 50));

  await init();
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
      // Swallow Monaco 0.55.3 internal crashes.
      // CRITICAL: Install BEFORE waiting for the editor, because Monaco
      // may already throw during initialization or while we're polling.
      setupMonacoErrorHandler();

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

    // ── Apply all features ──────────────────────────────────────────────

    await applyFeatures(currentAdapter, currentSettings);

    console.log('[CodeHelper] MAIN: initialization complete');
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

    if (currentAdapter && currentSettings) {
      await applyFeatures(currentAdapter, currentSettings);
    }

    respond?.({ received: true });
  }
});

// ── SPA Navigation Observer ────────────────────────────────────────────────

function setupNavigationObserver(): void {
  // 1. URL polling (catches hash changes, SPA routing)
  const urlCheckInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('[CodeHelper] MAIN: URL changed, reinitializing');
      lastUrl = currentUrl;
      reinitialize();
    }
  }, 1000);
  navigationCleanupFns.push(() => clearInterval(urlCheckInterval));

  // 2. popstate (back/forward buttons)
  const onPopState = () => {
    console.log('[CodeHelper] MAIN: popstate detected, reinitializing');
    lastUrl = window.location.href;
    reinitialize();
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
        console.log('[CodeHelper] MAIN: pushState navigation, reinitializing');
        lastUrl = currentUrl;
        reinitialize();
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
        console.log('[CodeHelper] MAIN: replaceState navigation, reinitializing');
        lastUrl = currentUrl;
        reinitialize();
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

// ── Bootstrap ──────────────────────────────────────────────────────────────

function bootstrap(): void {
  init();
  setupNavigationObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
