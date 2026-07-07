import { SettingsManager } from '../../core/settings';
import type { Settings } from '../../types/settings';
import { DEFAULT_SHORTCUTS } from '../../features/shortcuts/defaults';
import { BUILTIN_SNIPPETS } from '../../features/snippets/builtins';

const SITES = [
  { name: 'LeetCode', url: 'leetcode.com', key: 'leetcode' },
  { name: 'CodeChef', url: 'codechef.com', key: 'codechef' },
  { name: 'Codeforces', url: 'codeforces.com', key: 'codeforces' },
  { name: 'HackerRank', url: 'hackerrank.com', key: 'hackerrank' },
  { name: 'AtCoder', url: 'atcoder.jp', key: 'atcoder' },
  { name: 'GeeksforGeeks', url: 'geeksforgeeks.org', key: 'geeksforgeeks' },
  { name: 'HackerEarth', url: 'hackerearth.com', key: 'hackerearth' },
];

async function init() {
  try {
  const manager = new SettingsManager();
  const settings = await manager.init();

  // Tab navigation
  initTabs();

  // Load settings into UI
  loadAppearanceSettings(settings);
  loadEditingSettings(settings);
  loadHighlightsSettings(settings);
  loadShortcutsSettings(settings);
  loadSitesSettings(settings);

  // Save on change
  document.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('change', () => saveSettings(manager));
  });
  } catch (err) {
    console.error('[CodeHelper] Options init error:', err);
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId!)?.classList.add('active');
    });
  });
}

function loadAppearanceSettings(settings: Settings) {
  // Theme
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
  themeSelect.value = settings.theme.name;

  // Font
  const fontSelect = document.getElementById('font-select') as HTMLSelectElement;
  fontSelect.value = settings.font.family;

  const fontSize = document.getElementById('font-size') as HTMLInputElement;
  fontSize.value = String(settings.font.size);

  const lineHeight = document.getElementById('line-height') as HTMLInputElement;
  lineHeight.value = String(settings.font.lineHeight);

  const letterSpacing = document.getElementById('letter-spacing') as HTMLInputElement;
  letterSpacing.value = String(settings.font.letterSpacing);

  const ligatures = document.getElementById('ligatures') as HTMLInputElement;
  ligatures.checked = settings.font.ligatures;

  // Cursor
  const cursorWidth = document.getElementById('cursor-width') as HTMLInputElement;
  cursorWidth.value = String(settings.features.cursor.width);

  const cursorColor = document.getElementById('cursor-color') as HTMLInputElement;
  cursorColor.value = settings.features.cursor.color;

  const cursorBlink = document.getElementById('cursor-blink') as HTMLSelectElement;
  cursorBlink.value = settings.features.cursor.blinkStyle;

  // Selection
  const selectionBg = document.getElementById('selection-bg') as HTMLInputElement;
  selectionBg.value = settings.features.selection.backgroundColor;

  const selectionFg = document.getElementById('selection-fg') as HTMLInputElement;
  selectionFg.value = settings.features.selection.foregroundColor;
}

function loadEditingSettings(settings: Settings) {
  const snippetsEnabled = document.getElementById('snippets-enabled') as HTMLInputElement;
  snippetsEnabled.checked = settings.features.snippets.enabled;

  const autoCloseEnabled = document.getElementById('auto-close-enabled') as HTMLInputElement;
  autoCloseEnabled.checked = settings.features.autoClose.enabled;

  const indentationEnabled = document.getElementById('indentation-enabled') as HTMLInputElement;
  indentationEnabled.checked = settings.features.indentation.enabled;

  // Render snippet list
  const snippetList = document.getElementById('snippet-list')!;
  BUILTIN_SNIPPETS.forEach((snippet) => {
    const item = document.createElement('div');
    item.className = 'snippet-item';
    item.innerHTML = `
      <span><strong>${snippet.prefix[0]}</strong> - ${snippet.description}</span>
    `;
    snippetList.appendChild(item);
  });
}

function loadHighlightsSettings(settings: Settings) {
  const lineHighlightEnabled = document.getElementById('line-highlight-enabled') as HTMLInputElement;
  lineHighlightEnabled.checked = settings.features.lineHighlight.enabled;

  const lineHighlightColor = document.getElementById('line-highlight-color') as HTMLInputElement;
  lineHighlightColor.value = settings.features.lineHighlight.color;

  const lineHighlightOpacity = document.getElementById('line-highlight-opacity') as HTMLInputElement;
  lineHighlightOpacity.value = String(settings.features.lineHighlight.opacity);

  const bracketPairsEnabled = document.getElementById('bracket-pairs-enabled') as HTMLInputElement;
  bracketPairsEnabled.checked = settings.features.bracketPairs.enabled;

  const indentGuidesEnabled = document.getElementById('indent-guides-enabled') as HTMLInputElement;
  indentGuidesEnabled.checked = settings.features.indentGuides.enabled;

  const indentGuidesColor = document.getElementById('indent-guides-color') as HTMLInputElement;
  indentGuidesColor.value = settings.features.indentGuides.color;
}

function loadShortcutsSettings(settings: Settings) {
  const shortcutsEnabled = document.getElementById('shortcuts-enabled') as HTMLInputElement;
  shortcutsEnabled.checked = settings.features.shortcuts.enabled;

  const shortcutList = document.getElementById('shortcut-list')!;
  Object.entries(DEFAULT_SHORTCUTS).forEach(([id, def]) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    item.innerHTML = `
      <span>${def.description}</span>
      <code>${def.keys.win}</code>
    `;
    shortcutList.appendChild(item);
  });
}

function loadSitesSettings(settings: Settings) {
  const sitesList = document.getElementById('sites-list')!;
  SITES.forEach((site) => {
    const item = document.createElement('div');
    item.className = 'site-item';

    const enabled = settings.perSite[site.key] ?? true;

    item.innerHTML = `
      <div>
        <div class="site-name">${site.name}</div>
        <div class="site-url">${site.url}</div>
      </div>
      <input type="checkbox" data-site="${site.key}" ${enabled ? 'checked' : ''}>
    `;

    const checkbox = item.querySelector('input') as HTMLInputElement;
    checkbox.addEventListener('change', async () => {
      const manager = new SettingsManager();
      await manager.init();
      await manager.update({
        perSite: { [site.key]: checkbox.checked },
      });
    });

    sitesList.appendChild(item);
  });
}

async function saveSettings(manager: SettingsManager) {
  const settings: Partial<Settings> = {
    theme: {
      name: (document.getElementById('theme-select') as HTMLSelectElement).value as any,
    },
    font: {
      family: (document.getElementById('font-select') as HTMLSelectElement).value,
      size: parseInt((document.getElementById('font-size') as HTMLInputElement).value, 10),
      lineHeight: parseFloat((document.getElementById('line-height') as HTMLInputElement).value),
      letterSpacing: parseFloat(
        (document.getElementById('letter-spacing') as HTMLInputElement).value,
      ),
      ligatures: (document.getElementById('ligatures') as HTMLInputElement).checked,
    },
    features: {
      snippets: {
        enabled: (document.getElementById('snippets-enabled') as HTMLInputElement).checked,
        customSnippets: [],
      },
      autoClose: {
        enabled: (document.getElementById('auto-close-enabled') as HTMLInputElement).checked,
        pairs: { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' },
      },
      indentation: {
        enabled: (document.getElementById('indentation-enabled') as HTMLInputElement).checked,
      },
      lineHighlight: {
        enabled: (document.getElementById('line-highlight-enabled') as HTMLInputElement).checked,
        color: (document.getElementById('line-highlight-color') as HTMLInputElement).value,
        opacity: parseFloat(
          (document.getElementById('line-highlight-opacity') as HTMLInputElement).value,
        ),
      },
      bracketPairs: {
        enabled: (document.getElementById('bracket-pairs-enabled') as HTMLInputElement).checked,
      },
      indentGuides: {
        enabled: (document.getElementById('indent-guides-enabled') as HTMLInputElement).checked,
        color: (document.getElementById('indent-guides-color') as HTMLInputElement).value,
      },
      cursor: {
        enabled: true,
        width: parseInt((document.getElementById('cursor-width') as HTMLInputElement).value, 10),
        color: (document.getElementById('cursor-color') as HTMLInputElement).value,
        blinkStyle: (document.getElementById('cursor-blink') as HTMLSelectElement).value as any,
      },
      selection: {
        enabled: true,
        backgroundColor: (document.getElementById('selection-bg') as HTMLInputElement).value,
        foregroundColor: (document.getElementById('selection-fg') as HTMLInputElement).value,
      },
      shortcuts: {
        enabled: (document.getElementById('shortcuts-enabled') as HTMLInputElement).checked,
        mappings: {},
      },
    },
  };

  await manager.update(settings);

  // Notify active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED' });
    }
  } catch {
    // Tab might not have content script
  }
}

document.addEventListener('DOMContentLoaded', init);
