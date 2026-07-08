/**
 * SnippetSuggestWidget
 *
 * Custom HTML overlay that displays available snippet completions
 * without using Monaco's CompletionItemProvider (which is broken
 * in Monaco 0.55.3 on LeetCode).
 *
 * This widget shows a floating dropdown when the user types text
 * that matches a snippet prefix. It uses high z-index to appear
 * above all other elements.
 */

import type { EditorAdapter } from '../../adapters/types';
import type { Snippet } from '../../types/snippet';

export interface SnippetMatch {
  snippet: Snippet;
  prefix: string;
}

/** Theme colors extracted from the page or editor. */
interface WidgetTheme {
  bg: string;
  border: string;
  text: string;
  mutedText: string;
  selectedBg: string;
  selectedBorder: string;
  prefixColor: string;
  bodyColor: string;
  hoverBg: string;
  scrollbarThumb: string;
}

/** Default dark theme (fallback). */
const DARK_THEME: WidgetTheme = {
  bg: '#1e1e1e',
  border: '#454545',
  text: '#d4d4d4',
  mutedText: '#9a9a9a',
  selectedBg: 'rgba(55, 148, 255, 0.15)',
  selectedBorder: '#3794ff',
  prefixColor: '#569cd6',
  bodyColor: '#6a6a6a',
  hoverBg: 'rgba(255,255,255,0.05)',
  scrollbarThumb: 'rgba(255,255,255,0.15)',
};

/** Light theme for sites with light backgrounds. */
const LIGHT_THEME: WidgetTheme = {
  bg: '#ffffff',
  border: '#d4d4d4',
  text: '#1e1e1e',
  mutedText: '#666666',
  selectedBg: 'rgba(55, 148, 255, 0.1)',
  selectedBorder: '#3794ff',
  prefixColor: '#0451a5',
  bodyColor: '#888888',
  hoverBg: 'rgba(0,0,0,0.04)',
  scrollbarThumb: 'rgba(0,0,0,0.15)',
};

export class SnippetSuggestWidget {
  private element: HTMLDivElement | null = null;
  private adapter: EditorAdapter;
  private items: SnippetMatch[] = [];
  private selectedIndex = 0;
  private isVisible = false;
  private currentTheme: WidgetTheme = DARK_THEME;
  private cachedLine = 0;
  private cachedColumn = 0;

  constructor(adapter: EditorAdapter) {
    this.adapter = adapter;
    this.detectTheme();
  }

  /**
   * Show the snippet suggestion dropdown with the given matches.
   * Positions itself near the cursor using Monaco's coordinate API.
   */
  show(matches: SnippetMatch[], cursorLine: number, cursorColumn: number): void {
    if (!this.element) {
      this.createElement();
    }

    this.items = matches;
    this.selectedIndex = 0;
    this.cachedLine = cursorLine;
    this.cachedColumn = cursorColumn;

    // Re-detect theme in case the page theme changed
    this.detectTheme();
    this.applyTheme();

    this.render();

    // Position the widget near the cursor
    this.positionNearCursor(cursorLine, cursorColumn);

    this.isVisible = true;
    this.element!.style.display = 'block';
  }

  /** Reposition the widget near a new cursor position (e.g. after typing). */
  reposition(cursorLine: number, cursorColumn: number): void {
    if (!this.isVisible || !this.element) return;
    this.cachedLine = cursorLine;
    this.cachedColumn = cursorColumn;
    this.positionNearCursor(cursorLine, cursorColumn);
  }

  /** Hide the dropdown. */
  hide(): void {
    this.isVisible = false;
    this.items = [];
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /** Whether the dropdown is currently visible. */
  get visible(): boolean {
    return this.isVisible;
  }

  /** Get the currently selected match. */
  getSelected(): SnippetMatch | null {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
      return this.items[this.selectedIndex];
    }
    return null;
  }

  /** Select the next item (cycling). */
  selectNext(): void {
    if (this.items.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    this.highlightSelected();
  }

  /** Select the previous item (cycling). */
  selectPrev(): void {
    if (this.items.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
    this.highlightSelected();
  }

  /** Get all currently shown items. */
  getItems(): SnippetMatch[] {
    return [...this.items];
  }

  /** Remove the widget from the DOM. */
  destroy(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.items = [];
    this.isVisible = false;
  }

  // ── Private ─────────────────────────────────────────────────────

  /**
   * Detect the current page theme by checking background brightness.
   */
  private detectTheme(): void {
    try {
      const body = document.body;
      if (!body) return;
      const bg = window.getComputedStyle(body).backgroundColor;
      // Parse rgb values
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        this.currentTheme = luminance > 0.5 ? LIGHT_THEME : DARK_THEME;
        return;
      }
    } catch {
      // ignore
    }
    this.currentTheme = DARK_THEME;
  }

  /**
   * Apply the current theme to the widget element.
   */
  private applyTheme(): void {
    if (!this.element) return;
    const t = this.currentTheme;
    this.element.style.background = t.bg;
    this.element.style.border = `1px solid ${t.border}`;
    this.element.style.color = t.text;
    this.element.style.boxShadow = `0 8px 24px rgba(0,0,0,${t === LIGHT_THEME ? '0.12' : '0.5'})`;

    // Update CSS custom properties for dynamic theming
    this.element.style.setProperty('--ch-widget-selected-bg', t.selectedBg);
    this.element.style.setProperty('--ch-widget-selected-border', t.selectedBorder);
    this.element.style.setProperty('--ch-widget-hover-bg', t.hoverBg);
    this.element.style.setProperty('--ch-widget-prefix-color', t.prefixColor);
    this.element.style.setProperty('--ch-widget-body-color', t.bodyColor);
    this.element.style.setProperty('--ch-widget-muted-text', t.mutedText);
    this.element.style.setProperty('--ch-widget-scrollbar-thumb', t.scrollbarThumb);
  }

  private createElement(): void {
    this.element = document.createElement('div');
    this.element.className = 'ch-snippet-suggest';
    this.element.setAttribute('data-ch-managed', '');
    this.element.style.cssText = `
      display: none;
      position: fixed;
      z-index: 999999;
      border-radius: 6px;
      min-width: 280px;
      max-width: 480px;
      max-height: 320px;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      padding: 4px 0;
    `;

    document.body.appendChild(this.element);
  }

  private render(): void {
    if (!this.element) return;

    if (this.items.length === 0) {
      this.element.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const snippet = item.snippet;
      const prefix = item.prefix;
      const bodyPreview = this.getBodyPreview(snippet.body);
      const isSelected = i === this.selectedIndex;

      html += `
        <div class="ch-snippet-item ${isSelected ? 'ch-snippet-item-selected' : ''}" data-index="${i}">
          <div class="ch-snippet-item-prefix">
            <span class="ch-snippet-prefix-text">${this.escapeHtml(prefix)}</span>
            <span class="ch-snippet-description">${this.escapeHtml(snippet.description || '')}</span>
          </div>
          <div class="ch-snippet-item-body">${this.escapeHtml(bodyPreview)}</div>
        </div>
      `;
    }

    this.element.innerHTML = html;

    // Click handlers — use mousedown to prevent focus loss from the editor
    this.element.querySelectorAll('.ch-snippet-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt((el as HTMLElement).dataset.index || '0', 10);
        this.selectedIndex = index;
        // Hide the widget; the engine will read getSelected() after the event
        this.hide();
      });
    });

    // Scroll selected item into view
    const selectedEl = this.element.querySelector('.ch-snippet-item-selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }

    // Inject styles if not already present
    this.injectStyles();
  }

  private highlightSelected(): void {
    if (!this.element) return;
    const items = this.element.querySelectorAll('.ch-snippet-item');
    items.forEach((el, i) => {
      el.classList.toggle('ch-snippet-item-selected', i === this.selectedIndex);
    });

    const selectedEl = this.element.querySelector('.ch-snippet-item-selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  private positionNearCursor(line: number, column: number): void {
    if (!this.element) return;

    try {
      // Try to get the monaco editor's position API for accurate positioning
      const monacoEditor = (this.adapter as any).getMonacoEditor?.();
      if (monacoEditor && typeof monacoEditor.getScrolledVisiblePosition === 'function') {
        const pos = monacoEditor.getScrolledVisiblePosition({
          lineNumber: line + 1,
          column: column + 1,
        });
        if (pos) {
          // The editor's DOM node gives us the offset
          const editorDom = monacoEditor.getDomNode();
          if (editorDom) {
            const editorRect = editorDom.getBoundingClientRect();
            let top = editorRect.top + pos.top + 22; // below cursor line
            let left = editorRect.left + pos.left;

            // Ensure the widget doesn't go off-screen
            const widgetWidth = this.element.offsetWidth || 320;
            const widgetHeight = this.element.offsetHeight || 200;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Adjust horizontal position
            if (left + widgetWidth > viewportWidth - 10) {
              left = viewportWidth - widgetWidth - 10;
            }
            if (left < 10) left = 10;

            // If below would go off-screen, show above
            if (top + widgetHeight > viewportHeight - 10) {
              top = editorRect.top + pos.top - widgetHeight - 4;
            }
            if (top < 10) top = 10;

            this.element.style.left = `${Math.round(left)}px`;
            this.element.style.top = `${Math.round(top)}px`;
            return;
          }
        }
      }
    } catch {
      // Fallback to editor root element positioning
    }

    // Fallback: position relative to the editor's root element
    try {
      const rootEl = this.adapter.getRootElement();
      if (rootEl) {
        const rect = rootEl.getBoundingClientRect();
        this.element.style.left = `${rect.left + 10}px`;
        this.element.style.top = `${rect.top + 40}px`;
      } else {
        this.element.style.left = '100px';
        this.element.style.top = '100px';
      }
    } catch {
      this.element.style.left = '100px';
      this.element.style.top = '100px';
    }
  }

  private getBodyPreview(body: string): string {
    // Show first line, truncated to ~60 chars
    const firstLine = body.split('\n')[0] || '';
    return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private injectStyles(): void {
    if (document.getElementById('ch-snippet-suggest-styles')) return;

    const style = document.createElement('style');
    style.id = 'ch-snippet-suggest-styles';
    style.textContent = `
      .ch-snippet-item {
        padding: 6px 12px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
        border-left: 3px solid transparent;
        transition: background 0.1s;
      }
      .ch-snippet-item:hover {
        background: var(--ch-widget-hover-bg, rgba(255,255,255,0.05));
      }
      .ch-snippet-item-selected {
        background: var(--ch-widget-selected-bg, rgba(55, 148, 255, 0.15));
        border-left-color: var(--ch-widget-selected-border, #3794ff);
      }
      .ch-snippet-item-prefix {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ch-snippet-prefix-text {
        font-weight: 600;
        color: var(--ch-widget-prefix-color, #569cd6);
        font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
        font-size: 12px;
      }
      .ch-snippet-description {
        color: var(--ch-widget-muted-text, #9a9a9a);
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-snippet-item-body {
        color: var(--ch-widget-body-color, #6a6a6a);
        font-size: 11px;
        font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
        padding-left: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-snippet-suggest::-webkit-scrollbar {
        width: 6px;
      }
      .ch-snippet-suggest::-webkit-scrollbar-track {
        background: transparent;
      }
      .ch-snippet-suggest::-webkit-scrollbar-thumb {
        background: var(--ch-widget-scrollbar-thumb, rgba(255,255,255,0.15));
        border-radius: 3px;
      }
    `;
    document.head?.appendChild(style);
  }
}
