// ISOLATED world content script
// Only responsibility: manage chrome.storage settings and forward to MAIN world

import { settingsManager } from '../core/settings';
import { sendToMain, onMessage } from '../core/bridge';
import type { Settings } from '../types/settings';

function detectSite(): string | null {
  const url = window.location.href;
  if (/leetcode\.com/.test(url)) return 'leetcode';
  if (/codechef\.com/.test(url)) return 'codechef';
  if (/codeforces\.com/.test(url)) return 'codeforces';
  if (/hackerrank\.com/.test(url)) return 'hackerrank';
  if (/atcoder\.jp/.test(url)) return 'atcoder';
  if (/geeksforgeeks\.org/.test(url)) return 'geeksforgeeks';
  if (/hackerearth\.com/.test(url)) return 'hackerearth';
  return null;
}

/**
 * Send settings to MAIN world.
 *
 * Use fireAndForget=true for the initial send (MAIN world might not have
 * loaded its message listener yet — the bridge's retry+timeout would cause
 * an 8-second delay before falling through to defaults).
 *
 * Use fireAndForget=false for subsequent changes (subscribe/popup), where
 * the MAIN world is definitely already listening and we want confirmation.
 */
async function sendSettingsToMain(settings: Settings, fireAndForget = false): Promise<void> {
  try {
    if (fireAndForget) {
      // Fire directly via postMessage without bridge retry/wait.
      // The MAIN world's onMessage handler will process this when ready.
      window.postMessage(
        {
          namespace: '__CH_BRIDGE__',
          type: 'SETTINGS_UPDATE' as const,
          payload: settings,
          source: 'isolated',
        },
        '*',
      );
    } else {
      await sendToMain('SETTINGS_UPDATE', settings);
    }
  } catch {
    // MAIN world might not be ready yet — will get settings when it asks for SETTINGS_REQUEST
  }
}

/**
 * Check if the extension context is still valid.
 * Returns false if the extension was reloaded/uninstalled.
 * Uses try-catch because chrome.runtime.id getter throws TypeError
 * when the extension context is invalidated.
 */
function isExtensionContextValid(): boolean {
  try {
    if (typeof chrome === 'undefined') return false;
    // Access chrome.runtime — if the getter throws, context is invalidated
    const runtime = chrome.runtime;
    if (!runtime) return false;
    const id = runtime.id;
    return !!id;
  } catch {
    return false;
  }
}

/** Safer access to chrome.runtime.onMessage. */
function safeOnMessageAddListener(
  listener: (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => boolean | undefined,
): boolean {
  if (!isExtensionContextValid()) return false;
  try {
    const onMsg = chrome.runtime.onMessage;
    if (!onMsg || typeof onMsg.addListener !== 'function') return false;
    onMsg.addListener(listener);
    return true;
  } catch (err) {
    console.warn('[CodeHelper] ISOLATED: failed to add chrome.runtime.onMessage listener:', err);
    return false;
  }
}

// ── Bridge listener for SETTINGS_REQUEST (registered at MODULE scope) ──
onMessage(async (type, _payload, respond) => {
  if (type === 'SETTINGS_REQUEST') {
    try {
      if (settingsManager.current) {
        respond?.(settingsManager.current);
      } else {
        respond?.({ __fallback: true });
      }
    } catch {
      // ignore
    }
  }
});

async function init(): Promise<void> {
  try {
    console.log('[CodeHelper] ISOLATED: init');
    const site = detectSite();
    if (!site) {
      console.log('[CodeHelper] ISOLATED: not a supported site');
      return;
    }
    console.log('[CodeHelper] ISOLATED: detected site:', site);

    // Load settings from chrome.storage
    let settings: Settings;
    try {
      settings = await settingsManager.init();
      console.log('[CodeHelper] ISOLATED: settings loaded, enabled:', settings.enabled);
    } catch (err) {
      console.warn('[CodeHelper] ISOLATED: failed to load settings:', err);
      return;
    }

    if (!settings.enabled || !settings.perSite[site]) {
      console.log('[CodeHelper] ISOLATED: disabled for site:', site);
      return;
    }

    // Send initial settings to MAIN world
    sendSettingsToMain(settings, true);

    // Re-send settings when chrome.storage changes (popup/options edits)
    settingsManager.subscribe((newSettings) => {
      console.log('[CodeHelper] ISOLATED: settings changed, forwarding to MAIN');
      sendSettingsToMain(newSettings, false);
    });

    // Also listen for chrome.runtime messages from popup/options
    safeOnMessageAddListener((message, _sender, sendResponse) => {
      if (!isExtensionContextValid()) return false;
      if (
        message.type === 'SETTINGS_CHANGED' ||
        message.type === 'THEME_CHANGED' ||
        message.type === 'FEATURE_TOGGLED'
      ) {
        console.log('[CodeHelper] ISOLATED: received', message.type, 'from popup/options');
        sendSettingsToMain(settingsManager.current, false);
        try { sendResponse?.({ applied: true }); } catch { /* ignore */ }
      }
      return true;
    });

    // Periodically check if extension context is still valid
    const contextCheckInterval = setInterval(() => {
      if (!isExtensionContextValid()) {
        clearInterval(contextCheckInterval);
        console.warn('[CodeHelper] ISOLATED: Extension context invalidated. Please reload the page.');
      }
    }, 10000);

    window.addEventListener('beforeunload', () => {
      clearInterval(contextCheckInterval);
    });
  } catch (err) {
    console.warn('[CodeHelper] ISOLATED: init threw unexpectedly:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
