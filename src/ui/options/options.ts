import { SettingsManager } from '../../core/settings';
import type { Settings, SnippetPack } from '../../types/settings';
import type { Snippet } from '../../types/snippet';
import { DEFAULT_SHORTCUTS } from '../../features/shortcuts/defaults';
import { BUILTIN_SNIPPETS } from '../../features/snippets/builtins';
import { snippetPackManager } from '../../features/snippets/pack-manager';

// SVG icon helpers
const icons = {
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  delete: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  globe: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
};

// Module-level state for custom snippets
let customSnippets: Snippet[] = [];
let editingIndex: number | null = null;
let snippetListenersAdded = false;

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
  loadSnippetsSettings(settings);
  loadHighlightsSettings(settings);
  loadShortcutsSettings(settings);
  loadSitesSettings(settings);

  	// Initialize snippet gallery
  	initGallery();
  	initUpdateNotifications();

  // Save on change
  document.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('change', () => saveSettings(manager));
  });
  } catch (err) {
    console.error('[CodeHelper] Options init error:', err);
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.nav-item');
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

  // Render built-in snippet list (clear first to avoid duplicates)
  const snippetList = document.getElementById('snippet-list')!;
  snippetList.innerHTML = '';
  BUILTIN_SNIPPETS.forEach((snippet) => {
    const item = document.createElement('div');
    item.className = 'snippet-item';
    item.innerHTML = `
      <span><strong>${snippet.prefix[0]}</strong> - ${snippet.description}</span>
    `;
    snippetList.appendChild(item);
  });
}

function loadSnippetsSettings(settings: Settings) {
  customSnippets = [...settings.features.snippets.customSnippets];
  renderCustomSnippets();

  // Only add event listeners once (first call)
  if (!snippetListenersAdded) {
    const addBtn = document.getElementById('snippet-add-btn')!;
    addBtn.addEventListener('click', handleAddSnippet);

    const cancelBtn = document.getElementById('snippet-cancel-btn')!;
    cancelBtn.addEventListener('click', cancelEdit);
    snippetListenersAdded = true;
  }
}

function renderCustomSnippets() {
  const list = document.getElementById('custom-snippet-list')!;
  list.innerHTML = '';

  if (customSnippets.length === 0) {
    list.innerHTML = '<div class="snippet-empty">No custom snippets yet. Add one above!</div>';
    return;
  }

  customSnippets.forEach((snippet, index) => {
    const item = document.createElement('div');
    item.className = 'custom-snippet-item';

    const langTags = snippet.language
      .map((l) => `<span class="snippet-lang-tag">${l}</span>`)
      .join('');

    item.innerHTML = `
      <div class="custom-snippet-info">
        <div class="custom-snippet-header">
          <code class="custom-snippet-prefix">${snippet.prefix[0]}</code>
          <span class="custom-snippet-desc">${snippet.description}</span>
        </div>
        <pre class="custom-snippet-body">${escapeHtml(snippet.body)}</pre>
        <div class="custom-snippet-langs">${langTags}</div>
      </div>
      <div class="custom-snippet-actions">
        <button class="btn-icon btn-edit" data-index="${index}" title="Edit">${icons.edit}</button>
        <button class="btn-icon btn-delete" data-index="${index}" title="Delete">${icons.delete}</button>
      </div>
    `;

    // Edit button handler
    item.querySelector('.btn-edit')!.addEventListener('click', () => {
      populateFormForEdit(index);
    });

    // Delete button handler
    item.querySelector('.btn-delete')!.addEventListener('click', () => {
      handleDeleteSnippet(index);
    });

    list.appendChild(item);
  });
}

function handleAddSnippet() {
  const prefixInput = document.getElementById('snippet-prefix') as HTMLInputElement;
  const bodyInput = document.getElementById('snippet-body') as HTMLTextAreaElement;
  const descInput = document.getElementById('snippet-description') as HTMLInputElement;
  const langInput = document.getElementById('snippet-language') as HTMLInputElement;

  const prefix = prefixInput.value.trim();
  const body = bodyInput.value.trim();
  const description = descInput.value.trim() || prefix;
  const languageRaw = langInput.value.trim();
  const language = languageRaw
    ? languageRaw.split(',').map((l) => l.trim()).filter(Boolean)
    : ['*'];

  if (!prefix) {
    prefixInput.focus();
    return;
  }
  if (!body) {
    bodyInput.focus();
    return;
  }

  const snippet: Snippet = { prefix: [prefix], body, description, language };

  if (editingIndex !== null) {
    // Update existing snippet
    customSnippets[editingIndex] = snippet;
    editingIndex = null;
    document.getElementById('snippet-cancel-btn')!.style.display = 'none';
    document.getElementById('snippet-add-btn')!.textContent = 'Add Snippet';
  } else {
    // Add new snippet
    customSnippets.push(snippet);
  }

  clearForm();
  renderCustomSnippets();
  saveCustomSnippets();
}

function populateFormForEdit(index: number) {
  const snippet = customSnippets[index];
  editingIndex = index;

  (document.getElementById('snippet-prefix') as HTMLInputElement).value =
    snippet.prefix[0] || '';
  (document.getElementById('snippet-body') as HTMLTextAreaElement).value =
    snippet.body;
  (document.getElementById('snippet-description') as HTMLInputElement).value =
    snippet.description;
  (document.getElementById('snippet-language') as HTMLInputElement).value =
    snippet.language.join(', ');

  document.getElementById('snippet-add-btn')!.textContent = 'Save Changes';
  document.getElementById('snippet-cancel-btn')!.style.display = 'inline-block';

  // Scroll form into view
  document.querySelector('.snippet-form')!.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEdit() {
  editingIndex = null;
  clearForm();
  document.getElementById('snippet-add-btn')!.textContent = 'Add Snippet';
  document.getElementById('snippet-cancel-btn')!.style.display = 'none';
}

function handleDeleteSnippet(index: number) {
  customSnippets.splice(index, 1);
  if (editingIndex === index) {
    cancelEdit();
  } else if (editingIndex !== null && editingIndex > index) {
    editingIndex--;
  }
  renderCustomSnippets();
  saveCustomSnippets();
}

function clearForm() {
  (document.getElementById('snippet-prefix') as HTMLInputElement).value = '';
  (document.getElementById('snippet-body') as HTMLTextAreaElement).value = '';
  (document.getElementById('snippet-description') as HTMLInputElement).value = '';
  (document.getElementById('snippet-language') as HTMLInputElement).value = '';
}

async function saveCustomSnippets() {
  const manager = new SettingsManager();
  const current = await manager.init();
  await manager.update({
    features: {
      ...current.features,
      snippets: {
        enabled: (document.getElementById('snippets-enabled') as HTMLInputElement).checked,
        customSnippets,
      },
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  shortcutList.innerHTML = '';
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
  sitesList.innerHTML = '';
  SITES.forEach((site) => {
    const item = document.createElement('div');
    item.className = 'site-item';

    const enabled = settings.perSite[site.key] ?? true;

    item.innerHTML = `
      <div>
        <div class="site-name">${site.name}</div>
        <div class="site-url">${site.url}</div>
      </div>
      <label class="toggle-label" style="margin-bottom:0;">
        <input type="checkbox" class="toggle-input" data-site="${site.key}" ${enabled ? 'checked' : ''}>
        <span class="toggle-switch"></span>
      </label>
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
        customSnippets,
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

// ═══════════════════════════════════════════════════════════════════════════
//  SNIPPET GALLERY — UPDATE NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

let galleryPendingUpdates: any[] = [];

function initUpdateNotifications(): void {
  const updateAllBtn = document.getElementById('gallery-update-all-btn');
  const dismissAllBtn = document.getElementById('gallery-update-dismiss-all-btn');
  const diffCloseBtn = document.getElementById('gallery-diff-close');

  updateAllBtn?.addEventListener('click', async () => {
    updateAllBtn.textContent = 'Updating...';
    (updateAllBtn as HTMLButtonElement).disabled = true;
    await snippetPackManager.updateAllPacks();
    await loadGallery();
    renderUpdateNotifications();
  });

  dismissAllBtn?.addEventListener('click', async () => {
    for (const update of galleryPendingUpdates) {
      await snippetPackManager.dismissUpdate(update.pack.id);
    }
    galleryPendingUpdates = [];
    renderUpdateNotifications();
  });

  diffCloseBtn?.addEventListener('click', () => {
    const overlay = document.getElementById('gallery-diff-overlay');
    if (overlay) overlay.style.display = 'none';
  });

  // Close overlay on overlay background click
  const overlay = document.getElementById('gallery-diff-overlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
}

async function renderUpdateNotifications(): Promise<void> {
  const section = document.getElementById('gallery-updates-section');
  const list = document.getElementById('gallery-updates-list');
  const countEl = document.getElementById('gallery-updates-count');
  const infoEl = document.getElementById('gallery-updates-info');
  const updateAllBtn = document.getElementById('gallery-update-all-btn');
  const dismissAllBtn = document.getElementById('gallery-update-dismiss-all-btn');

  if (!section || !list) return;

  const updates = galleryPendingUpdates;

  if (updates.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  countEl!.textContent = `(${updates.length})`;
  updateAllBtn!.style.display = updates.length > 1 ? 'inline-flex' : 'none';
  dismissAllBtn!.style.display = 'inline-flex';

  const totalChanges = updates.reduce(
    (sum, u) => sum + u.diff.stats.changeCount,
    0,
  );
  infoEl!.textContent = `${updates.length} pack${updates.length > 1 ? 's have' : ' has'} updates — ${totalChanges} total change${totalChanges !== 1 ? 's' : ''}`;

  list.innerHTML = updates
    .map(
      (update, i) => `
    <div class="update-item">
      <div class="update-item-info">
        <div class="update-item-name">${escapeHtmlStatic(update.pack.name)}</div>
        <div class="update-item-versions">
          <span class="version-old">v${escapeHtmlStatic(update.currentVersion)}</span>
          &rarr;
          <span class="version-new">v${escapeHtmlStatic(update.remoteVersion)}</span>
        </div>
        <div style="font-size:12px;color:#94A3B8;margin-bottom:4px">
          <span style="color:#22c55e">+${update.diff.stats.newCount - update.diff.stats.oldCount > 0 ? update.diff.stats.newCount - update.diff.stats.oldCount : 0}</span>
          &middot;
          <span style="color:#EF4444">-${update.diff.removed.length}</span>
          &middot;
          <span style="color:#F59E0B">~${update.diff.modified.length}</span>
          snippets changed
        </div>
        <button class="update-item-diff-link" data-diff-index="${i}">View Changes</button>
      </div>
      <div class="update-item-actions">
        <button class="btn btn-primary" data-update-pack="${escapeHtmlStatic(update.pack.id)}" style="padding:4px 12px;font-size:12px;height:30px">Update</button>
        <button class="btn-icon" data-dismiss-update="${escapeHtmlStatic(update.pack.id)}" title="Dismiss" style="width:30px;height:30px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>`,
    )
    .join('');

  // Wire up update buttons
  list.querySelectorAll('[data-update-pack]').forEach((el) => {
    el.addEventListener('click', async () => {
      const packId = (el as HTMLElement).dataset.updatePack!;
      el.textContent = 'Updating...';
      (el as HTMLButtonElement).disabled = true;
      const ok = await snippetPackManager.updatePack(packId);
      if (ok) {
        await loadGallery();
        await snippetPackManager.checkForUpdates();
        galleryPendingUpdates = snippetPackManager.getPendingUpdates();
        renderUpdateNotifications();
      } else {
        el.textContent = 'Failed';
        setTimeout(() => {
          el.textContent = 'Update';
          (el as HTMLButtonElement).disabled = false;
        }, 2000);
      }
    });
  });

  // Wire up dismiss buttons
  list.querySelectorAll('[data-dismiss-update]').forEach((el) => {
    el.addEventListener('click', async () => {
      const packId = (el as HTMLElement).dataset.dismissUpdate!;
      await snippetPackManager.dismissUpdate(packId);
      galleryPendingUpdates = snippetPackManager.getPendingUpdates();
      renderUpdateNotifications();
    });
  });

  // Wire up diff view links
  list.querySelectorAll('[data-diff-index]').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt((el as HTMLElement).dataset.diffIndex!, 10);
      const update = updates[idx];
      if (update) showDiffOverlay(update);
    });
  });
}

function showDiffOverlay(update: any): void {
  const overlay = document.getElementById('gallery-diff-overlay');
  const title = document.getElementById('gallery-diff-title');
  const summary = document.getElementById('gallery-diff-summary');
  const lists = document.getElementById('gallery-diff-lists');

  if (!overlay) return;

  title!.textContent = `${update.pack.name} — Changes`;

  const d = update.diff;
  summary!.innerHTML = `
    <strong>v${escapeHtmlStatic(update.currentVersion)}</strong>
    &rarr;
    <strong>v${escapeHtmlStatic(update.remoteVersion)}</strong>
    &nbsp;&middot;&nbsp;
    ${d.stats.oldCount} &rarr; ${d.stats.newCount} snippets
    &nbsp;&middot;&nbsp;
    <span style="color:#22c55e">+${d.added.length}</span>
    <span style="color:#EF4444">-${d.removed.length}</span>
    <span style="color:#F59E0B">~${d.modified.length}</span>
  `;

  let html = '';

  if (d.added.length > 0) {
    html += `<div class="diff-section">
      <div class="diff-section-title added">Added (+${d.added.length})</div>
      ${d.added.map((key: string) => `<span class="diff-tag added">${escapeHtmlStatic(key)}</span>`).join('')}
    </div>`;
  }

  if (d.removed.length > 0) {
    html += `<div class="diff-section">
      <div class="diff-section-title removed">Removed (-${d.removed.length})</div>
      ${d.removed.map((key: string) => `<span class="diff-tag removed">${escapeHtmlStatic(key)}</span>`).join('')}
    </div>`;
  }

  if (d.modified.length > 0) {
    html += `<div class="diff-section">
      <div class="diff-section-title modified">Modified (~${d.modified.length})</div>
      ${d.modified.map((key: string) => `<span class="diff-tag modified">${escapeHtmlStatic(key)}</span>`).join('')}
    </div>`;
  }

  lists!.innerHTML = html || '<div style="color:#94A3B8;font-size:13px">No changes detected.</div>';

  overlay.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════════════════
//  SNIPPET GALLERY
// ═══════════════════════════════════════════════════════════════════════════

/** Currently displayed packs (filtered). */
let galleryPacks: SnippetPack[] = [];
let galleryInstalledPacks: SnippetPack[] = [];

function initGallery(): void {
  const refreshBtn = document.getElementById('gallery-refresh-btn');
  const retryBtn = document.getElementById('gallery-retry-btn');
  const searchInput = document.getElementById('gallery-search') as HTMLInputElement;
  const langFilter = document.getElementById('gallery-language-filter') as HTMLSelectElement;

  refreshBtn?.addEventListener('click', () => loadGallery());
  retryBtn?.addEventListener('click', () => loadGallery());
  searchInput?.addEventListener('input', () => renderGallery());
  langFilter?.addEventListener('change', () => renderGallery());

  // Load gallery on first tab activation
  const galleryTab = document.querySelector('[data-tab="snippet-gallery"]');
  if (galleryTab) {
    // Listen for clicks on the gallery tab button
    const tabClickHandler = () => {
      if (!galleryPacks.length && !galleryInstalledPacks.length) {
        loadGallery();
      }
    };
    galleryTab.addEventListener('click', tabClickHandler, { once: true });
  }

  // Also load immediately if we're on the gallery tab
  if (galleryTab?.classList.contains('active')) {
    loadGallery();
  }
}

async function loadGallery(): Promise<void> {
  const loadingEl = document.getElementById('gallery-loading');
  const errorEl = document.getElementById('gallery-error');
  const installedSection = document.getElementById('gallery-installed-section');
  const availableSection = document.getElementById('gallery-available-section');

  loadingEl!.style.display = 'block';
  errorEl!.style.display = 'none';

  try {
    // Fetch installed packs from storage
    galleryInstalledPacks = await snippetPackManager.getInstalledPacks();

    // Fetch available packs from remote index
    const index = await snippetPackManager.fetchIndex();
    if (!index) {
      loadingEl!.style.display = 'none';
      errorEl!.style.display = 'block';
      return;
    }

    // Merge installed status into available packs
    galleryPacks = index.packs.map((pack) => {
      const installed = galleryInstalledPacks.find((p) => p.id === pack.id);
      return installed ? { ...pack, installed: true, enabled: installed.enabled } : pack;
    });

    loadingEl!.style.display = 'none';

    // Check for updates after loading gallery data
    try {
      galleryPendingUpdates = await snippetPackManager.checkForUpdates();
      renderUpdateNotifications();
    } catch (updateErr) {
      console.warn('[CodeHelper] Update check failed:', updateErr);
    }

    renderGallery();
  } catch (err) {
    console.warn('[CodeHelper] Gallery load error:', err);
    loadingEl!.style.display = 'none';
    errorEl!.style.display = 'block';
  }
}

function renderGallery(): void {
  const searchInput = document.getElementById('gallery-search') as HTMLInputElement;
  const langFilter = document.getElementById('gallery-language-filter') as HTMLSelectElement;
  const installedList = document.getElementById('gallery-installed-list')!;
  const availableList = document.getElementById('gallery-available-list')!;
  const installedSection = document.getElementById('gallery-installed-section')!;
  const availableSection = document.getElementById('gallery-available-section')!;
  const installedCount = document.getElementById('gallery-installed-count')!;
  const availableCount = document.getElementById('gallery-available-count')!;

  const search = (searchInput?.value || '').toLowerCase().trim();
  const lang = langFilter?.value || '';

  // Filter packs
  const filtered = galleryPacks.filter((pack) => {
    if (search && !pack.name.toLowerCase().includes(search) &&
        !pack.description.toLowerCase().includes(search)) return false;
    if (lang && !pack.languages.some((l) => l.includes(lang))) return false;
    return true;
  });

  const installed = filtered.filter((p) => p.installed);
  const available = filtered.filter((p) => !p.installed);

  // Render installed
  installedSection.style.display = installed.length > 0 ? 'block' : 'none';
  installedCount.textContent = `(${installed.length})`;
  installedList.innerHTML = installed.length > 0
    ? installed.map((pack, i) => renderPackCard(pack, i, true)).join('')
    : '<div class="snippet-empty">No installed packs match your search.</div>';

  // Render available
  availableCount.textContent = `(${available.length})`;
  availableList.innerHTML = available.length > 0
    ? available.map((pack, i) => renderPackCard(pack, i, false)).join('')
    : '<div class="snippet-empty">No packs found. Try a different search or check back later.</div>';

  // Wire up event handlers
  installedList.querySelectorAll('[data-pack-install]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.packInstall!;
      const pack = galleryPacks.find((p) => p.id === id);
      if (!pack) return;
      if (pack.installed) {
        await snippetPackManager.uninstallPack(id);
      } else {
        el.textContent = 'Installing...';
        (el as HTMLButtonElement).disabled = true;
        await snippetPackManager.installPack(pack);
      }
      // Reload gallery
      await loadGallery();
    });
  });

  installedList.querySelectorAll('[data-pack-toggle]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.packToggle!;
      const pack = galleryPacks.find((p) => p.id === id);
      if (!pack) return;
      const newEnabled = !pack.enabled;
      await snippetPackManager.togglePack(id, newEnabled);
      pack.enabled = newEnabled;
      renderGallery();
    });
  });
}

function renderPackCard(pack: SnippetPack, _index: number, installed: boolean): string {
  const langTags = pack.languages
    .slice(0, 3)
    .map((l) => `<span class="snippet-lang-tag">${escapeHtmlStatic(l)}</span>`)
    .join('');

  const statusIcon = installed
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : '';

  const toggleBtn = installed
    ? `<button class="btn-icon" data-pack-toggle="${escapeHtmlStatic(pack.id)}" title="${pack.enabled ? 'Disable' : 'Enable'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${pack.enabled
            ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
            : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"'
          }
        </svg>
      </button>`
    : '';

  const actionBtn = installed
    ? `<button class="btn-icon btn-delete" data-pack-install="${escapeHtmlStatic(pack.id)}" title="Uninstall">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>`
    : `<button class="btn btn-primary" data-pack-install="${escapeHtmlStatic(pack.id)}" style="padding:4px 12px;font-size:12px;height:30px">Install</button>`;

  return `
    <div class="custom-snippet-item" style="align-items:center">
      <div class="custom-snippet-info">
        <div class="custom-snippet-header">
          <span style="font-weight:600;color:#F8FAFC">${escapeHtmlStatic(pack.name)}</span>
          ${statusIcon}
          <span style="color:#64748B;font-size:12px">v${escapeHtmlStatic(pack.version)}</span>
        </div>
        <div style="color:#94A3B8;font-size:12px;margin-bottom:4px">${escapeHtmlStatic(pack.description)}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="custom-snippet-langs" style="margin-top:0">${langTags}</div>
          ${pack.installed ? `<span style="color:#64748B;font-size:11px">${pack.author ? `by ${escapeHtmlStatic(pack.author)}` : ''}</span>` : ''}
          ${pack.installed ? `<span style="color:#64748B;font-size:11px">${pack.enabled ? 'Enabled' : 'Disabled'}</span>` : ''}
        </div>
      </div>
      <div class="custom-snippet-actions" style="align-items:center;padding-top:0">
        ${toggleBtn}
        ${actionBtn}
      </div>
    </div>
  `;
}

function escapeHtmlStatic(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', init);
