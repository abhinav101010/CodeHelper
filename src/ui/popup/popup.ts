import { SettingsManager } from '../../core/settings';
import type { Settings } from '../../types/settings';

const FEATURE_NAMES: Record<string, string> = {
  snippets: 'Smart Snippets',
  autoClose: 'Auto Close',
  indentation: 'Smart Indentation',
  lineHighlight: 'Line Highlight',
  bracketPairs: 'Bracket Pairs',
  indentGuides: 'Indent Guides',
  cursor: 'Custom Cursor',
  selection: 'Selection Colors',
  shortcuts: 'Keyboard Shortcuts',
};

async function init() {
  try {
  const manager = new SettingsManager();
  const settings = await manager.init();

  // Master toggle
  const masterToggle = document.getElementById('master-toggle') as HTMLInputElement;
  masterToggle.checked = settings.enabled;
  masterToggle.addEventListener('change', async () => {
    await manager.update({ enabled: masterToggle.checked });
    notifyContentScript('SETTINGS_CHANGED');
  });

  // Theme selector
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
  themeSelect.value = settings.theme.name;
  themeSelect.addEventListener('change', async () => {
    await manager.update({ theme: { name: themeSelect.value as any } });
    notifyContentScript('THEME_CHANGED');
  });

  // Font selector
  const fontSelect = document.getElementById('font-select') as HTMLSelectElement;
  fontSelect.value = settings.font.family;
  fontSelect.addEventListener('change', async () => {
    await manager.update({ font: { family: fontSelect.value } });
    notifyContentScript('SETTINGS_CHANGED');
  });

  // Font size
  const fontSize = document.getElementById('font-size') as HTMLInputElement;
  fontSize.value = String(settings.font.size);
  fontSize.addEventListener('change', async () => {
    await manager.update({ font: { size: parseInt(fontSize.value, 10) } });
    notifyContentScript('SETTINGS_CHANGED');
  });

  // Feature toggles
  const featuresList = document.getElementById('features-list')!;
  for (const [key, displayName] of Object.entries(FEATURE_NAMES)) {
    const featureSettings = settings.features[key as keyof typeof settings.features];
    const enabled = featureSettings && typeof featureSettings === 'object'
      ? (featureSettings as any).enabled
      : !!featureSettings;

    const toggle = createFeatureToggle(key, displayName, enabled);
    featuresList.appendChild(toggle);
  }

  // Settings button
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Open options link
  document.getElementById('open-options')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  } catch (err) {
    console.error('[CodeHelper] Popup init error:', err);
  }
}

function createFeatureToggle(key: string, displayName: string, enabled: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = 'feature-toggle';

  const label = document.createElement('label');
  label.textContent = displayName;

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = enabled;
  toggle.addEventListener('change', async () => {
    const manager = new SettingsManager();
    await manager.init();
    await manager.update({
      features: {
        [key]: { enabled: toggle.checked },
      },
    } as any);
    notifyContentScript('FEATURE_TOGGLED');
  });

  row.appendChild(label);
  row.appendChild(toggle);
  return row;
}

async function notifyContentScript(type: string, payload?: unknown): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type, payload });
    }
  } catch {
    // Tab might not have content script
  }
}

document.addEventListener('DOMContentLoaded', init);
