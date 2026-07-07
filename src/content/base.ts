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

async function sendSettingsToMain(settings: Settings): Promise<void> {
  try {
    await sendToMain('SETTINGS_UPDATE', settings);
  } catch {
    // MAIN world might not be ready yet, will get settings when it asks
  }
}

async function init(): Promise<void> {
  console.log('[CodeHelper] ISOLATED: init');
  const site = detectSite();
  if (!site) {
    console.log('[CodeHelper] ISOLATED: not a supported site');
    return;
  }
  console.log('[CodeHelper] ISOLATED: detected site:', site);

  // Load settings from chrome.storage
  const settings = await settingsManager.init();
  console.log('[CodeHelper] ISOLATED: settings loaded, enabled:', settings.enabled);

  if (!settings.enabled || !settings.perSite[site]) {
    console.log('[CodeHelper] ISOLATED: disabled for site:', site);
    return;
  }

  // Send initial settings to MAIN world
  await sendSettingsToMain(settings);

  // Re-send settings when chrome.storage changes (popup/options edits)
  settingsManager.subscribe((newSettings) => {
    console.log('[CodeHelper] ISOLATED: settings changed, forwarding to MAIN');
    sendSettingsToMain(newSettings);
  });

  // Also listen for chrome.runtime messages from popup/options
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SETTINGS_CHANGED' || message.type === 'THEME_CHANGED' || message.type === 'FEATURE_TOGGLED') {
      console.log('[CodeHelper] ISOLATED: received', message.type, 'from popup/options');
      sendSettingsToMain(settingsManager.current);
      sendResponse({ applied: true });
    }
    return true;
  });

  // Listen for messages from MAIN world
  onMessage(async (type, payload, respond) => {
    if (type === 'SETTINGS_REQUEST') {
      // MAIN world is asking for current settings
      respond?.(settingsManager.current);
    }
  });
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
