import type { EditorAdapter } from '../../adapters/types';
import type { SnippetSettings } from '../../types/settings';
import type { Snippet, SnippetTrigger, TabstopInfo } from '../../types/snippet';
import { parseSnippet } from './parser';
import { resolveVariable } from './templates';
import { BUILTIN_SNIPPETS } from './builtins';
import { SnippetSuggestWidget } from './widget';
import { detectLanguage } from '../../core/language';

// ────────────────────────────────────────────────────────────────────────────
//  SnippetSession  —  VS Code–style tab-stop navigation (Monaco only)
// ────────────────────────────────────────────────────────────────────────────

class SnippetSession {
  private editor: any = null;
  /**
   * Tabstop metadata — positions are only used for the initial decoration
   * placement. After that, all position reads go through decoration IDs
   * (which Monaco tracks automatically as the document is edited).
   */
  private tabstops: TabstopInfo[] = [];
  /** Tabstops sorted by index (excluding $0 from middle, $0 always last). */
  private navigationOrder: TabstopInfo[] = [];
  /** Index into navigationOrder. -1 = before first. */
  private currentNavIndex = -1;
  /**
   * Decoration IDs — one per tabstop, created ONCE and never destroyed
   * until the session ends. Monaco's model tracks these ranges: when text
   * is inserted or deleted before a decoration, its range shifts by exactly
   * the right amount. This is the core mechanism that keeps positions live.
   */
  private decorationIds: string[] = [];
  private disposables: Array<{ dispose(): void }> = [];
  private isMirrorUpdating = false;
  private destroyed = false;
  private editorId = '';
  /** Called when the session self-destructs (decorations gone, etc.) so the
   *  engine can null its reference and reset state. */
  private onDestroy?: () => void;

  constructor(adapter: EditorAdapter, tabstops: TabstopInfo[], onDestroy?: () => void) {
    this.editor = (adapter as any).getMonacoEditor?.();
    if (!this.editor) {
      this.destroyed = true;
      return;
    }
    this.editorId = typeof this.editor.getId === 'function' ? this.editor.getId() : '';
    this.onDestroy = onDestroy;

    this.tabstops = tabstops;

    // Build navigation order: numeric indices > 0 sorted ascending,
    // then $0 (index 0) at the very end if present
    const nonZero = [...tabstops].filter((t) => t.index > 0).sort((a, b) => a.index - b.index);
    const zero = tabstops.find((t) => t.index === 0);
    this.navigationOrder = zero ? [...nonZero, zero] : nonZero;
    this.currentNavIndex = -1;

    // Create decorations ONCE — these IDs persist for the entire session
    this.createDecorations();

    // Listen for content changes to support mirrored placeholders
    try {
      const contentDisp = this.editor.onDidChangeModelContent((e: any) => {
        this.handleContentChange(e);
      });
      this.disposables.push({ dispose: () => contentDisp?.dispose() });
    } catch {
      // ignore
    }

    // Listen for cursor/selection changes to detect click-outside
    try {
      const selDisp = this.editor.onDidChangeCursorSelection((e: any) => {
        this.handleSelectionChange(e);
      });
      this.disposables.push({ dispose: () => selDisp?.dispose() });
    } catch {
      // ignore
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  advance(): boolean {
    if (this.destroyed || !this.editor) return true;

    const nextIndex = this.currentNavIndex + 1;
    if (nextIndex >= this.navigationOrder.length) {
      this.destroy();
      return true;
    }

    this.currentNavIndex = nextIndex;
    if (!this.moveToTabstop(this.navigationOrder[nextIndex])) {
      // Target decoration has no valid range — session is stale
      this.destroy();
      return true;
    }
    this.highlightActiveTabstop();
    return false;
  }

  retreat(): boolean {
    if (this.destroyed || !this.editor) return true;

    if (this.currentNavIndex <= 0) {
      return true;
    }

    this.currentNavIndex--;
    if (!this.moveToTabstop(this.navigationOrder[this.currentNavIndex])) {
      this.destroy();
      return true;
    }
    this.highlightActiveTabstop();
    return false;
  }

  isForEditor(editorId: string): boolean {
    return this.editorId === editorId;
  }

  isActive(): boolean {
    return !this.destroyed;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Notify engine so it can null its reference and reset state
    try { this.onDestroy?.(); } catch { /* ignore callback errors */ }

    // Remove all decorations at once
    if (this.editor && this.decorationIds.length > 0) {
      try {
        const model = this.editor.getModel();
        if (model && typeof model.deltaDecorations === 'function') {
          model.deltaDecorations(this.decorationIds, []);
        }
      } catch {
        // ignore
      }
    }
    this.decorationIds = [];

    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        // ignore
      }
    }
    this.disposables = [];

    this.editor = null;
  }

  // ── Live range helpers ──────────────────────────────────────────────────

  /**
   * Read the current document range for a tabstop from its decoration.
   * Monaco automatically adjusts decoration ranges when the document is
   * edited — inserts before a decoration push it right, deletions pull
   * it left. This is the ONLY way to get correct positions after edits.
   */
  private getLiveRange(ts: TabstopInfo): {
    startLineNumber: number; startColumn: number;
    endLineNumber: number; endColumn: number;
  } | null {
    if (!this.editor) return null;
    const idx = this.tabstops.indexOf(ts);
    if (idx < 0 || idx >= this.decorationIds.length) return null;
    const model = this.editor.getModel();
    if (!model) return null;
    try {
      const range = model.getDecorationRange(this.decorationIds[idx]);
      if (range) {
        return {
          startLineNumber: range.startLineNumber,
          startColumn: range.startColumn,
          endLineNumber: range.endLineNumber,
          endColumn: range.endColumn,
        };
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Check whether this session's decorations still exist and have content.
   * Returns true if the session was destroyed.
   *
   * Detection covers:
   * - No decorations left — user deleted all snippet text
   * - ANY decoration has a null range — removed from the document
   * - Active decoration collapsed to zero width — user deleted placeholder text
   */
  private validateDecorations(): boolean {
    if (this.destroyed) return true;
    if (this.decorationIds.length === 0) { this.destroy(); return true; }

    const model = this.editor?.getModel?.();
    if (!model) { this.destroy(); return true; }

    // Check ALL decorations: if ANY has a null range, the snippet is broken
    for (let i = 0; i < this.decorationIds.length; i++) {
      try {
        const range = model.getDecorationRange(this.decorationIds[i]);
        if (!range) { this.destroy(); return true; }
      } catch {
        this.destroy(); return true;
      }
    }

    // If the ACTIVE decoration collapsed to zero width, the placeholder
    // text was deleted — the snippet is no longer navigable.
    if (this.currentNavIndex >= 0 && this.currentNavIndex < this.navigationOrder.length) {
      const current = this.navigationOrder[this.currentNavIndex];
      const idx = this.tabstops.indexOf(current);
      if (idx >= 0 && idx < this.decorationIds.length) {
        try {
          const range = model.getDecorationRange(this.decorationIds[idx]);
          if (range &&
              range.startLineNumber === range.endLineNumber &&
              range.startColumn === range.endColumn) {
            this.destroy();
            return true;
          }
        } catch {
          this.destroy(); return true;
        }
      }
    }

    return false;
  }

  // ── Event handlers ──────────────────────────────────────────────────────

  private handleContentChange(_e: any): void {
    if (this.destroyed || !this.editor || this.isMirrorUpdating) return;
    if (this.validateDecorations()) return;
    if (this.currentNavIndex < 0 || this.currentNavIndex >= this.navigationOrder.length) return;

    const current = this.navigationOrder[this.currentNavIndex];
    if (current.index === 0) return;

    // Find siblings with the same index (mirrored placeholders)
    const siblings = this.tabstops.filter((t) => t.index === current.index && t !== current);
    if (siblings.length === 0) return;

    const model = this.editor.getModel();
    if (!model) return;

    // Read text from the ACTIVE placeholder's LIVE range
    let currentText: string;
    try {
      const range = this.getLiveRange(current);
      if (!range) return;
      currentText = model.getValueInRange(range);
    } catch {
      return;
    }

    // Apply to siblings using THEIR live ranges
    this.isMirrorUpdating = true;
    try {
      const edits: any[] = [];
      for (const s of siblings) {
        const sr = this.getLiveRange(s);
        if (sr) {
          edits.push({ range: sr, text: currentText });
        }
      }
      if (edits.length > 0) {
        this.editor.executeEdits('codehelper-snippet-mirror', edits);
      }
    } catch {
      // ignore
    }
    this.isMirrorUpdating = false;
  }

  private handleSelectionChange(_e: any): void {
    if (this.destroyed || !this.editor) return;
    if (this.validateDecorations()) return;
    if (this.currentNavIndex < 0 || this.currentNavIndex >= this.navigationOrder.length) return;

    try {
      const sel = this.editor.getSelection();
      if (!sel) return;
      const cursorLine = sel.positionLineNumber ?? sel.startLineNumber;

      // Check if cursor is within any tabstop's LIVE decoration range.
      // This uses model.getDecorationRange() — not the original ts.line —
      // so it correctly handles positions after edits.
      const onTabstop = this.tabstops.some((ts) => {
        const r = this.getLiveRange(ts);
        if (!r) return false;
        return cursorLine >= r.startLineNumber && cursorLine <= r.endLineNumber;
      });
      if (!onTabstop) {
        this.destroy();
      }
    } catch {
      // ignore
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  private moveToTabstop(ts: TabstopInfo): boolean {
    if (!this.editor) return false;

    try {
      const range = this.getLiveRange(ts);
      if (!range) return false;

      // Select the placeholder text so the user can type over it
      this.editor.setSelection(range);
      this.editor.revealRangeInCenter(range);
      return true;
    } catch {
      return false;
    }
  }

  // ── Decorations ────────────────────────────────────────────────────────

  /**
   * Create decorations ONCE. The IDs are stored permanently in
   * `this.decorationIds`. Monaco's model tracks these ranges — when text
   * is inserted or deleted before a decoration, its range shifts automatically.
   * We NEVER destroy and re-create decorations during the session.
   */
  private createDecorations(): void {
    if (!this.editor) return;
    try {
      const model = this.editor.getModel();
      if (!model) return;

      const decorations = this.tabstops.map((ts) => ({
        range: {
          startLineNumber: ts.line + 1,
          startColumn: ts.column + 1,
          endLineNumber: ts.line + 1 + (ts.lineCount ?? 0),
          endColumn: ts.column + 1 + ts.length,
        },
        options: {
          inlineClassName: 'ch-snippet-placeholder',
          stickiness: 1, // NeverGrowsWhenTypingAtEdges
          showIfCollapsed: true,
        },
      }));

      this.decorationIds = model.deltaDecorations([], decorations);
    } catch {
      // ignore
    }
  }

  /**
   * Update ONLY the CSS class on each decoration (active vs inactive).
   * Uses `model.changeDecorations` which modifies options in-place without
   * destroying/recreating the decoration — the tracked range stays alive.
   */
  private highlightActiveTabstop(): void {
    if (!this.editor) return;
    try {
      const model = this.editor.getModel();
      if (!model || typeof model.changeDecorations !== 'function') return;

      model.changeDecorations((changeAccessor: any) => {
        for (let i = 0; i < this.tabstops.length; i++) {
          if (i >= this.decorationIds.length) break;
          const ts = this.tabstops[i];
          const navIdx = this.navigationOrder.indexOf(ts);
          const isActive = this.currentNavIndex >= 0 && navIdx === this.currentNavIndex;

          // Read the current tracked range and pass it back unchanged.
          const liveRange = model.getDecorationRange(this.decorationIds[i]);
          if (!liveRange) continue;

          changeAccessor.changeDecoration(this.decorationIds[i], liveRange, {
            inlineClassName: isActive ? 'ch-snippet-placeholder-active' : 'ch-snippet-placeholder',
            stickiness: 1,
            showIfCollapsed: true,
          });
        }
      });
    } catch {
      // ignore
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  SnippetEngine
// ────────────────────────────────────────────────────────────────────────────

/**
 * SnippetEngine
 *
 * Provides snippet expansion strictly via Tab-key detection.
 *
 * IMPORTANT: This engine does NOT register a Monaco CompletionItemProvider.
 * Monaco 0.55.3 (used by LeetCode) has a buggy snippet-processing pipeline
 * that crashes ALL autocomplete when any CompletionItemProvider is present,
 * even with kind:Text and plain-string insertText.  The only reliable
 * approach is Tab-expand only — the user types a prefix and presses Tab,
 * which replaces the prefix with the expanded snippet body and activates
 * VS Code–style tab-stop navigation.
 */
export class SnippetEngine {
  private adapter: EditorAdapter;
  private settings: SnippetSettings;
  private session: SnippetSession | null = null;
  private disposables: Array<{ dispose(): void }> = [];
  private domHandler: ((e: KeyboardEvent) => void) | null = null;
  private editorBubbleHandler: ((e: KeyboardEvent) => void) | null = null;
  private suggestWidget: SnippetSuggestWidget;
  private contentChangeTimer: number | null = null;
  private lastCursorPos: { line: number; column: number } = { line: 0, column: 0 };
  private suppressWidget = false;
  /** True while a content-change rAF is pending. Cursor listener defers hiding when set. */
  private contentUpdatePending = false;

  constructor(adapter: EditorAdapter, settings: SnippetSettings) {
    this.adapter = adapter;
    this.settings = settings;
    this.suggestWidget = new SnippetSuggestWidget(adapter);
    // Use a single DOM-level capture handler for ALL key events.
    // Monaco 0.55.3 (LeetCode) may not reliably fire onKeyDown for Tab,
    // and having both an adapter handler + DOM handler causes double-expansion.
    this.registerDomFallback();
    // Register content change listener for the suggestion widget
    this.registerContentListener();
    // Register cursor selection listener to hide widget when cursor moves
    this.registerCursorListener();
    // Register undo listener to reset state after Ctrl+Z
    this.registerUndoListener();
  }

  /**
   * DOM-level fallback handler for Tab key.
   * Uses capture phase to intercept Tab BEFORE Monaco processes it.
   * This is essential because Monaco 0.55.3 (LeetCode's custom build)
   * might not fire onKeyDown reliably for Tab.
   */
  private registerDomFallback(): void {
    this.domHandler = (e: KeyboardEvent) => {
      try {
        if (!e?.key) return;

        // Only intercept relevant keys
        if (
          e.key !== 'Tab' &&
          e.key !== 'Escape' &&
          e.key !== 'ArrowDown' &&
          e.key !== 'ArrowUp' &&
          e.key !== 'Enter'
        )
          return;

        // Check if focus is inside the editor's root element
        const rootEl = this.adapter.getRootElement();
        if (!rootEl || !rootEl.contains(e.target as Node)) return;

        // ── Arrow key navigation in suggestion widget ────────────────
        if (this.suggestWidget.visible) {
          if (e.key === 'ArrowDown') {
            this.suggestWidget.selectNext();
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.key === 'ArrowUp') {
            this.suggestWidget.selectPrev();
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.key === 'Escape') {
            this.hideSuggestions();
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
            const selected = this.suggestWidget.getSelected();
            if (selected) {
              this.hideSuggestions();
              this.expandTrigger(selected.snippet, selected.prefix);
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            // No selection — don't consume the event; let it fall through
            // to the non-widget Tab handler (findTriggerWord → expandSnippet).
            // This ensures snippet expansion still works when the widget
            // is visible but empty or hasn't populated items yet.
          }
        }

        // ── Active snippet session ─────────────────────────────────────
        if (this.session && this.session.isActive()) {
          if (e.key === 'Escape') {
            this.session.destroy();
            this.session = null;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.key === 'Tab' && !e.shiftKey) {
            const handled = this.session.advance();
            if (!this.session?.isActive()) this.session = null;
            // ALWAYS consume Tab while a session exists — even when advance()
            // destroys the session (past last placeholder). Without this,
            // Monaco inserts a tab character and the user needs a second Tab.
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.key === 'Tab' && e.shiftKey) {
            const handled = this.session.retreat();
            if (!this.session?.isActive()) this.session = null;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          return;
        }

        // ── No active session — expand snippet on Tab ──────────────────
        if (e.key === 'Tab' && !e.shiftKey) {
          const trigger = this.findTriggerWord();
          if (trigger) {
            this.expandSnippet(trigger);
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // If no snippet match, let the event naturally reach Monaco
          // so native autocomplete Tab-acceptance still works.
          return;
        }
      } catch (err) {
        console.warn('[CodeHelper] Snippet DOM fallback threw:', err);
      }
    };

    document.addEventListener('keydown', this.domHandler, { capture: true });

    // ── Bubble-phase fallback: clean up tab inserted by Monaco ─────────
    // Monaco 0.55.3 (LeetCode) has its own Tab handler that may run
    // BEFORE our capture-phase handler on the textarea element. When that
    // happens, Monaco inserts a tab character despite our preventDefault().
    // This bubble-phase handler fires AFTER Monaco's handler and removes
    // the unwanted tab if a session was active.
    this.editorBubbleHandler = (e: KeyboardEvent) => {
      try {
        if (e?.key !== 'Tab' || e.shiftKey) return;
        if (!this.session || !this.session.isActive()) return;

        const rootEl = this.adapter.getRootElement();
        if (!rootEl || !rootEl.contains(e.target as Node)) return;

        // Monaco may have inserted a tab. Delete it.
        const monacoEditor = (this.adapter as any).getMonacoEditor?.();
        if (!monacoEditor) return;
        const model = monacoEditor.getModel?.();
        if (!model) return;
        const sel = monacoEditor.getSelection?.();
        if (!sel) return;

        const pos = sel.getPosition();
        const line = model.getLineContent(pos.lineNumber);
        const charBefore = pos.column > 1 ? line[pos.column - 2] : '';
        if (charBefore === '\t') {
          model.pushEditOperations([], [{
            range: {
              startLineNumber: pos.lineNumber,
              startColumn: pos.column - 1,
              endLineNumber: pos.lineNumber,
              endColumn: pos.column,
            },
            text: '',
          }], () => null);
        }
      } catch {
        // ignore
      }
    };
    const monacoEl = this.adapter.getRootElement();
    if (monacoEl) {
      monacoEl.addEventListener('keydown', this.editorBubbleHandler, false);
      this.disposables.push({
        dispose: () => monacoEl.removeEventListener('keydown', this.editorBubbleHandler!, false),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONTENT LISTENER — snippet suggestion widget trigger
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Listens for content changes and shows the snippet suggestion widget
   * when the user types text that matches snippet prefixes.
   */
  private registerContentListener(): void {
    const disposable = this.adapter.onDidChangeContent(() => {
      // Don't show widget during snippet expansion (suppressWidget is set
      // synchronously before any edits and cleared by rAF/timeout after).
      if (this.suppressWidget) return;

      // Mark content update pending — cursor listener will defer hiding while set.
      // Monaco fires onDidChangeModelContent BEFORE updating the cursor position,
      // so the content listener reads a stale cursor. We defer to the next frame
      // where the cursor has been updated.
      this.contentUpdatePending = true;

      if (this.contentChangeTimer) {
        cancelAnimationFrame(this.contentChangeTimer);
      }
      this.contentChangeTimer = requestAnimationFrame(() => {
        this.contentUpdatePending = false;
        this.updateSuggestions();
        // Reposition widget if it's visible (cursor moved due to typing)
        if (this.suggestWidget.visible) {
          this.repositionWidget();
        }
        this.contentChangeTimer = null;
      });
    });
    this.disposables.push(disposable);
  }

  /**
   * Hides the widget when the cursor moves to a position where
   * the typed word no longer matches any snippet prefix.
   */
  private registerCursorListener(): void {
    const disposable = this.adapter.onDidChangeCursorSelection(() => {
      if (!this.suggestWidget.visible) return;
      if (this.suppressWidget) return;
      if (this.session && this.session.isActive()) return;

      // Defer hiding when a content change is pending — the content listener's
      // rAF will re-evaluate with the correct cursor position and decide
      // whether to keep the widget visible or hide it.
      if (this.contentUpdatePending) return;

      try {
        const cursor = this.adapter.getCursorPosition();
        if (!cursor) {
          this.hideSuggestions();
          return;
        }

        const line = this.adapter.getLine(cursor.line);
        if (typeof line !== 'string') {
          this.hideSuggestions();
          return;
        }

        const textBeforeCursor = line.substring(0, cursor.column);
        if (!textBeforeCursor || textBeforeCursor.length === 0) {
          this.hideSuggestions();
          return;
        }

        // Extract current word
        const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
        const currentWord = wordMatch ? wordMatch[1] : '';
        if (currentWord.length === 0) {
          this.hideSuggestions();
          return;
        }

        // Check if any currently shown snippet still matches (prefix match)
        const items = this.suggestWidget.getItems();
        const stillValid = items.some((item) => {
          return item.prefix.startsWith(currentWord);
        });

        if (!stillValid) {
          this.hideSuggestions();
        }
      } catch {
        // ignore
      }
    });
    this.disposables.push(disposable);
  }

  /**
   * Reset snippet state when the user undoes (Ctrl+Z / Cmd+Z) after
   * expanding a snippet. Without this, suppressWidget stays true and
   * the session remains active, breaking all further snippet functionality.
   */
  private registerUndoListener(): void {
    const handler = (e: KeyboardEvent) => {
      const isUndo =
        (e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey;
      if (!isUndo) return;

      // Check if focus is inside the editor
      const rootEl = this.adapter.getRootElement();
      if (!rootEl || !rootEl.contains(e.target as Node)) return;

      // Reset all snippet state so the next content change re-evaluates
      if (this.suppressWidget || (this.session && this.session.isActive())) {
        this.suppressWidget = false;
        if (this.session) {
          this.session.destroy();
          this.session = null;
        }
        this.hideSuggestions();
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    this.disposables.push({ dispose: () => document.removeEventListener('keydown', handler, { capture: true }) });
  }

  private updateSuggestions(): void {
    // The caller (registerContentListener) already uses requestAnimationFrame
    // to ensure Monaco has updated the cursor position after content changes.
    // Monaco fires onDidChangeModelContent BEFORE updating cursor, so reading
    // getCursorPosition() directly returns the stale pre-edit position.
    // Calling _doUpdateSuggestions directly avoids a double-rAF delay.
    try {
      this._doUpdateSuggestions();
    } catch (err) {
      console.warn('[CodeHelper] _doUpdateSuggestions threw:', err);
      this.hideSuggestions();
    }
  }

  private _doUpdateSuggestions(): void {
    const cursor = this.adapter.getCursorPosition();
    if (!cursor) {
      this.hideSuggestions();
      return;
    }

    // Don't re-show immediately if we just hid it
    this.lastCursorPos = { line: cursor.line, column: cursor.column };

    const line = this.adapter.getLine(cursor.line);
    if (typeof line !== 'string') {
      this.hideSuggestions();
      return;
    }

    const textBeforeCursor = line.substring(0, cursor.column);
    if (!textBeforeCursor || textBeforeCursor.length === 0) {
      this.hideSuggestions();
      return;
    }

    // Extract the current word being typed (word-boundary delimited).
    // Show snippets whose prefix STARTS WITH this word — prefix matching,
    // not exact matching. This gives VS Code-like "type ahead" behavior.
    const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
    const currentWord = wordMatch ? wordMatch[1] : '';
    if (currentWord.length === 0) {
      this.hideSuggestions();
      return;
    }

    const allSnippets = this.getAllSnippets();
    const matches: Array<{ snippet: Snippet; prefix: string }> = [];
    const seen = new Set<string>();

    for (const snippet of allSnippets) {
      if (!snippet?.prefix) continue;
      if (!snippet.body || typeof snippet.body !== 'string') continue;

      for (const prefix of snippet.prefix) {
        if (!prefix || typeof prefix !== 'string' || prefix.length === 0) continue;
        if (seen.has(prefix)) continue;

        // Prefix match: snippet prefix starts with what the user is typing.
        // "fo" shows "for", "fori", "forr" etc.
        if (prefix.startsWith(currentWord)) {
          seen.add(prefix);
          matches.push({ snippet, prefix });
        }
      }
    }

    if (matches.length > 0) {
      // Sort by relevance:
      // 1. Exact prefix match (currentWord === prefix) — always first
      // 2. Longer prefix match first (more specific = better)
      // 3. Alphabetical tiebreaker
      // 4. Shorter body wins
      matches.sort((a, b) => {
        // Exact match always wins over partial match
        const aExact = a.prefix === currentWord ? 1 : 0;
        const bExact = b.prefix === currentWord ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        // Longer prefix match first (more specific wins)
        if (a.prefix.length !== b.prefix.length) {
          return b.prefix.length - a.prefix.length;
        }
        // Alphabetical tiebreaker
        const prefixCmp = a.prefix.localeCompare(b.prefix);
        if (prefixCmp !== 0) return prefixCmp;
        // Shorter body wins
        return (a.snippet.body?.length ?? 0) - (b.snippet.body?.length ?? 0);
      });

      this.suggestWidget.show(matches, cursor.line, cursor.column);
    } else {
      this.hideSuggestions();
    }
  }

  private hideSuggestions(): void {
    this.suggestWidget.hide();
  }

  /**
   * Reposition the widget near the current cursor position.
   * Called when content changes so the widget follows the cursor.
   */
  private repositionWidget(): void {
    try {
      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return;
      this.suggestWidget.reposition(cursor.line, cursor.column);
    } catch {
      // ignore
    }
  }

  /**
   * Expand a specific snippet with the given prefix (used by widget selection).
   * Determines the actual typed length by examining what's before the cursor,
   * so it correctly handles cases where the user hasn't typed the full prefix.
   */
  private expandTrigger(snippet: Snippet, prefix: string): void {
    this.suppressWidget = true;
    try {
      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return;

      // Determine what the user actually typed by extracting the current word
      // before the cursor. This is safer than using prefix.length because
      // the user may press Tab before finishing the full prefix.
      const lineContent = this.adapter.getLine(cursor.line);
      const textBeforeCursor =
        typeof lineContent === 'string' ? lineContent.substring(0, cursor.column) : '';
      const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
      const currentWord = wordMatch ? wordMatch[1] : prefix;
      const triggerLength = currentWord.length;

      // Capture base indentation of the current line BEFORE deleting
      const baseIndent =
        typeof lineContent === 'string' ? (lineContent.match(/^[\t ]*/)?.[0] ?? '') : '';

      // Delete the trigger word
      const triggerStart = {
        line: cursor.line,
        column: cursor.column - triggerLength,
      };
      this.adapter.replaceRange({ start: triggerStart, end: cursor }, '');

      const insertPos = {
        line: cursor.line,
        column: cursor.column - triggerLength,
      };

      // Parse and resolve
      if (!snippet.body || typeof snippet.body !== 'string') return;
      const parsed = parseSnippet(snippet.body);
      if (!parsed || !Array.isArray(parsed.segments)) return;

      const resolved = this.resolveSegments(parsed.segments);
      if (!resolved) return;

      // Apply proper indentation to the resolved text and adjust tabstop columns
      const adjusted = this.applyBodyIndentation(
        resolved.text,
        resolved.tabstops,
        baseIndent,
        insertPos.line,
      );

      const finalText = adjusted?.text ?? resolved.text;
      const finalTabstops = adjusted?.tabstops ?? resolved.tabstops;

      // Insert the expanded body
      this.adapter.replaceRange({ start: insertPos, end: insertPos }, finalText);

      // Set up tabstop navigation
      if (Array.isArray(finalTabstops) && finalTabstops.length > 0) {
        const absoluteTabstops: TabstopInfo[] = [];
        for (const ts of finalTabstops) {
          if (!ts) continue;
          absoluteTabstops.push({
            index: ts.index,
            line: insertPos.line + ts.line,
            column: ts.line === 0 ? insertPos.column + ts.column : ts.column,
            length: ts.length,
            placeholder: ts.placeholder ?? '',
            lineCount: ts.lineCount ?? 0,
          });
        }

        if (this.session) {
          this.session.destroy();
          this.session = null;
        }

        this.session = new SnippetSession(this.adapter, absoluteTabstops, () => {
          this.session = null;
          this.suppressWidget = false;
        });

        if (this.session.isActive()) {
          this.session.advance();
        } else {
          this.session = null;
          const first = absoluteTabstops.find((t) => t.index > 0) ?? absoluteTabstops[0];
          if (first) {
            this.adapter.setCursorPosition({
              line: first.line,
              column: first.column,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[CodeHelper] expandTrigger threw:', err);
    } finally {
      // Reset suppressWidget after Monaco settles.
      requestAnimationFrame(() => {
        this.suppressWidget = false;
      });
      // Fallback: clear suppressWidget after500ms in case rAF doesn't fire
      // (e.g. page hidden) or session was destroyed before rAF ran.
      setTimeout(() => {
        this.suppressWidget = false;
      }, 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TRIGGER WORD DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  findTriggerWord(): SnippetTrigger | null {
    try {
      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return null;
      const line = this.adapter.getLine(cursor.line);
      if (typeof line !== 'string') return null;
      const textBeforeCursor = line.substring(0, cursor.column);
      if (!textBeforeCursor) return null;

      // Extract the current word being typed
      const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
      const currentWord = wordMatch ? wordMatch[1] : '';
      if (currentWord.length === 0) return null;

      const allSnippets = this.getAllSnippets();
      if (!Array.isArray(allSnippets) || allSnippets.length === 0) return null;

      let bestMatch: SnippetTrigger | null = null;
      let bestPrefixLength = 0;
      let hasExactMatch = false;

      for (const snippet of allSnippets) {
        if (!snippet || typeof snippet !== 'object') continue;
        if (!Array.isArray(snippet.prefix) || snippet.prefix.length === 0) continue;
        if (!snippet.body || typeof snippet.body !== 'string') continue;

        for (const prefix of snippet.prefix) {
          if (!prefix || typeof prefix !== 'string' || prefix.length === 0) continue;

          // Prefix match: snippet prefix starts with what user typed
          if (!prefix.startsWith(currentWord)) continue;

          const isExact = prefix === currentWord;

          // Exact match always beats partial match
          if (isExact && !hasExactMatch) {
            bestMatch = { snippet, triggerLength: currentWord.length };
            bestPrefixLength = prefix.length;
            hasExactMatch = true;
            continue;
          }

          // Among same category (exact vs partial), longer prefix wins
          if (isExact === hasExactMatch && prefix.length > bestPrefixLength) {
            bestMatch = { snippet, triggerLength: currentWord.length };
            bestPrefixLength = prefix.length;
          }
        }
      }

      return bestMatch;
    } catch (err) {
      console.warn('[CodeHelper] findTriggerWord threw:', err);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SNIPPET EXPANSION
  // ═══════════════════════════════════════════════════════════════════════════

  private expandSnippet(trigger: SnippetTrigger): void {
    this.suppressWidget = true;
    try {
      const { snippet, triggerLength } = trigger;
      if (!snippet || typeof triggerLength !== 'number') return;

      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return;

      // Capture base indentation of the current line BEFORE deleting
      const lineContent = this.adapter.getLine(cursor.line);
      const baseIndent =
        typeof lineContent === 'string' ? (lineContent.match(/^[\t ]*/)?.[0] ?? '') : '';

      // Delete the trigger word
      const triggerStart = {
        line: cursor.line,
        column: cursor.column - triggerLength,
      };
      this.adapter.replaceRange({ start: triggerStart, end: cursor }, '');

      const insertPos = {
        line: cursor.line,
        column: cursor.column - triggerLength,
      };

      // Parse and resolve
      if (!snippet.body || typeof snippet.body !== 'string') return;
      const parsed = parseSnippet(snippet.body);
      if (!parsed || !Array.isArray(parsed.segments)) return;

      const resolved = this.resolveSegments(parsed.segments);
      if (!resolved) return;

      // Apply proper indentation to the resolved text and adjust tabstop columns
      const adjusted = this.applyBodyIndentation(
        resolved.text,
        resolved.tabstops,
        baseIndent,
        insertPos.line,
      );

      const finalText = adjusted?.text ?? resolved.text;
      const finalTabstops = adjusted?.tabstops ?? resolved.tabstops;

      // Insert the expanded body
      this.adapter.replaceRange({ start: insertPos, end: insertPos }, finalText);

      // Set up tab-stop navigation
      if (Array.isArray(finalTabstops) && finalTabstops.length > 0) {
        // Convert relative tabstop positions to absolute positions
        const absoluteTabstops: TabstopInfo[] = [];
        for (const ts of finalTabstops) {
          if (!ts) continue;
          absoluteTabstops.push({
            index: ts.index,
            line: insertPos.line + ts.line,
            column: ts.line === 0 ? insertPos.column + ts.column : ts.column,
            length: ts.length,
            placeholder: ts.placeholder ?? '',
            lineCount: ts.lineCount ?? 0,
          });
        }

        // Dispose previous session if any
        if (this.session) {
          this.session.destroy();
          this.session = null;
        }

        // Create new session (only for Monaco — decorations need raw API)
        this.session = new SnippetSession(this.adapter, absoluteTabstops, () => {
          this.session = null;
          this.suppressWidget = false;
        });

        if (this.session.isActive()) {
          // Advance to first tabstop
          this.session.advance();
        } else {
          // Monaco not available, do basic cursor positioning
          this.session = null;
          const first = absoluteTabstops.find((t) => t.index > 0) ?? absoluteTabstops[0];
          if (first) {
            this.adapter.setCursorPosition({
              line: first.line,
              column: first.column,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[CodeHelper] expandSnippet threw:', err);
    } finally {
      requestAnimationFrame(() => {
        this.suppressWidget = false;
      });
      setTimeout(() => {
        this.suppressWidget = false;
      }, 500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SEGMENT RESOLVER
  // ═══════════════════════════════════════════════════════════════════════════

  private resolveSegments(
    segments: Array<{
      type: string;
      value?: string;
      index?: number;
      children?: any[];
    }>,
  ): {
    text: string;
    tabstops: Array<{
      index: number;
      line: number;
      column: number;
      length: number;
      placeholder: string;
      lineCount: number;
    }>;
  } | null {
    try {
      if (!Array.isArray(segments)) return null;

      let text = '';
      const tabstops: Array<{
        index: number;
        line: number;
        column: number;
        length: number;
        placeholder: string;
        lineCount: number;
      }> = [];
      let currentLine = 0;
      let currentColumn = 0;

      for (const segment of segments) {
        if (!segment || typeof segment !== 'object') continue;

        if (segment.type === 'text') {
          const value = typeof segment.value === 'string' ? segment.value : '';
          text += value;
          // Track newlines for multi-line accounting
          const newlines = value.split('\n');
          if (newlines.length > 1) {
            currentLine += newlines.length - 1;
            currentColumn = newlines[newlines.length - 1].length;
          } else {
            currentColumn += value.length;
          }
        } else if (segment.type === 'tabstop') {
          const index = typeof segment.index === 'number' ? segment.index : 0;
          const placeholder = segment.children?.[0]?.value || '';

          tabstops.push({
            index,
            line: currentLine,
            column: currentColumn,
            length: placeholder.length,
            placeholder,
            lineCount: 0,
          });

          text += placeholder;
          currentColumn += placeholder.length;
        } else if (segment.type === 'variable') {
          const value = resolveVariable(typeof segment.value === 'string' ? segment.value : '');
          text += value;
          const newlines = value.split('\n');
          if (newlines.length > 1) {
            currentLine += newlines.length - 1;
            currentColumn = newlines[newlines.length - 1].length;
          } else {
            currentColumn += value.length;
          }
        }
      }

      return { text, tabstops };
    } catch (err) {
      console.warn('[CodeHelper] resolveSegments threw:', err);
      return { text: '', tabstops: [] };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Transform leading \t characters in the snippet body to proper indentation
   * based on the current line's base indent and the editor's indent settings.
   *
   * In VS Code snippets, \t at the start of a line means "one level of
   * indentation relative to the insertion line". This method:
   * 1. Replaces each leading \t with `baseIndent + depth * indentUnit`
   * 2. Adjusts tabstop column positions to account for the changed prefix length
   *
   * Example: expanding `if` at column 4 (4 spaces indent):
   *   Body: "if ${1:condition}:\n\t${0:pass}"
   *   Line 2 has \t + "pass"
   *   → \t replaced with baseIndent (4 spaces) + indentUnit (4 spaces) = 8 spaces
   *   → Result: "if condition:\n        pass"
   */
  private applyBodyIndentation(
    text: string,
    relativeTabstops: Array<{
      index: number;
      line: number;
      column: number;
      length: number;
      placeholder: string;
      lineCount: number;
    }>,
    baseIndent: string,
    _insertLine: number,
  ): {
    text: string;
    tabstops: Array<{
      index: number;
      line: number;
      column: number;
      length: number;
      placeholder: string;
      lineCount: number;
    }>;
  } | null {
    // Single-line snippets don't need indentation adjustment
    const lines = text.split('\n');
    if (lines.length <= 1) return null;

    // Determine the editor's indent unit (spaces vs tabs)
    let indentUnit = '\t';
    try {
      const monacoEditor = (this.adapter as any).getMonacoEditor?.();
      if (monacoEditor) {
        const model = monacoEditor.getModel?.();
        if (model && typeof model.getOptions === 'function') {
          const opts = model.getOptions();
          if (opts) {
            // EditorOption.insertSpaces = 50, EditorOption.tabSize = 49
            const insertSpaces = opts.insertSpaces ?? true;
            const tabSize = opts.tabSize ?? 4;
            if (insertSpaces) {
              indentUnit = ' '.repeat(tabSize);
            }
          }
        } else {
          // Fallback: read from editor options directly
          const insertSpaces =
            monacoEditor.getOption?.(50) ??
            monacoEditor.getRawOptions?.()?.insertSpaces ??
            true;
          const tabSize =
            monacoEditor.getOption?.(49) ??
            monacoEditor.getRawOptions?.()?.tabSize ??
            4;
          if (insertSpaces) {
            indentUnit = ' '.repeat(tabSize);
          }
        }
      }
    } catch {
      // Fall back to tab character
    }

    // Track how many extra characters each line gains (for tabstop adjustment)
    const lineExtra = new Array(lines.length).fill(0);
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        // First line: inserted at cursor position, no indentation change
        processedLines.push(lines[i]);
        continue;
      }

      const raw = lines[i];

      // Count leading tab characters (indentation markers)
      let tabCount = 0;
      while (tabCount < raw.length && raw[tabCount] === '\t') {
        tabCount++;
      }

      if (tabCount === 0) {
        // Line without indentation markers: prefix with base indent
        // e.g., "except Exception:" → "    except Exception:"
        processedLines.push(baseIndent + raw);
        lineExtra[i] = baseIndent.length;
      } else {
        // Replace N leading tabs with (baseIndent + N * indentUnit)
        // e.g., "\tpass" at 4-space base → "        pass" (4 base + 4 indent)
        // e.g., "\t\tinner" at 4-space base → "            inner" (4 base + 8 indent)
        const replacement = baseIndent + indentUnit.repeat(tabCount);
        const rest = raw.substring(tabCount);
        processedLines.push(replacement + rest);
        lineExtra[i] = replacement.length - tabCount;
      }
    }

    // Adjust tabstop column positions for the indentation shift
    const adjustedTabstops = relativeTabstops.map((ts) => {
      let colShift = 0;
      // Sum extra length from all lines BEFORE this tabstop's line
      // AND the extra length of this tabstop's own line (its indentation changed).
      for (let i = 0; i <= ts.line && i < lineExtra.length; i++) {
        colShift += lineExtra[i];
      }
      return {
        ...ts,
        column: ts.column + colShift,
      };
    });

    return {
      text: processedLines.join('\n'),
      tabstops: adjustedTabstops,
    };
  }

  private getAllSnippets(): Snippet[] {
    const builtins = Array.isArray(BUILTIN_SNIPPETS) ? BUILTIN_SNIPPETS : [];
    const custom = Array.isArray(this.settings.customSnippets) ? this.settings.customSnippets : [];
    const all = [...builtins, ...custom];

    // Filter by the editor's current language
    const currentLang = detectLanguage(this.adapter);
    if (currentLang === 'unknown') return all;

    return all.filter((snippet) => {
      if (!snippet.language || !Array.isArray(snippet.language)) return true;
      // ['*'] means all languages
      if (snippet.language.includes('*')) return true;
      // Check if any of the snippet's languages match the current language
      return snippet.language.some(
        (lang) => lang.toLowerCase() === currentLang.toLowerCase(),
      );
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  updateSettings(settings: SnippetSettings): void {
    this.settings = settings;
    // Destroy active session on settings change
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }

  dispose(): void {
    // Destroy active session
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }

    // Destroy suggestion widget
    this.suggestWidget.destroy();

    // Remove DOM fallback handler
    if (this.domHandler) {
      try {
        document.removeEventListener('keydown', this.domHandler, { capture: true });
      } catch {
        // ignore
      }
      this.domHandler = null;
    }

    // Clear timers
    if (this.contentChangeTimer) {
      cancelAnimationFrame(this.contentChangeTimer);
      this.contentChangeTimer = null;
    }

    // Dispose disposables
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        // ignore
      }
    }
    this.disposables = [];
  }
}
