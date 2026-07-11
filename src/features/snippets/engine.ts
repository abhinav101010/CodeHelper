/**
 * SnippetEngine — VS Code–style snippet expansion with tab-stop navigation,
 * mirrored placeholders, custom suggestion widget, and local identifier autocomplete.
 *
 * Architecture
 * ────────────
 * Single capture-phase keydown handler intercepts Tab/Enter/Escape/Arrows.
 * A single centralized update function (performUpdate) decides widget visibility,
 * eliminating races between content changes, cursor moves, and snippet state.
 *
 * State machine
 * ─────────────
 *   IDLE         — normal editing, widget can show
 *   EXPANDING    — inside try block of expandSnippet, widget suppressed
 *   SESSION      — snippet session active, Tab navigates placeholders, widget hidden
 *
 * Decoration-based placeholder tracking
 * ─────────────────────────────────────
 * Uses Monaco's track-ranges (decorations) instead of brittle fixed offsets.
 */

import type { EditorAdapter, Disposable } from '../../adapters/types';
import type { Snippet, TabstopInfo } from '../../types/snippet';
import { BUILTIN_SNIPPETS } from './builtins';
import { parseSnippet } from './parser';
import { resolveVariable } from './templates';
import { SnippetSuggestWidget } from './widget';
import type { SuggestionItem, SnippetMatch, IdentifierSuggestion } from './widget';
import { detectLanguage } from '../../core/language';
import { IdentifierIndex } from '../autocomplete/index';
import { getCachedSnippets, preloadAll } from '../../snippet-loader';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

interface SnippetSettings {
  enabled: boolean;
  customSnippets: Snippet[];
}

export interface SnippetTrigger {
  snippet: Snippet;
  triggerLength: number;
}

const enum EngineState {
  IDLE = 0,
  EXPANDING = 1,
  SESSION = 2,
}

// ─────────────────────────────────────────────────────────────────────────────
//  SnippetSession — decoration-based tabstop navigation
// ─────────────────────────────────────────────────────────────────────────────

class SnippetSession {
  private editor: any = null;
  private tabstops: TabstopInfo[] = [];
  private navigationOrder: TabstopInfo[] = [];
  private currentNavIndex = -1;
  private decorationIds: string[] = [];
  private disposables: Array<Disposable> = [];
  private isMirrorUpdating = false;
  private destroyed = false;
  private editorId = '';
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

    // Build navigation order: non-zero indices sorted ascending, then $0 at end
    const nonZero = [...tabstops].filter((t) => t.index > 0).sort((a, b) => a.index - b.index);
    const zero = tabstops.find((t) => t.index === 0);
    this.navigationOrder = zero ? [...nonZero, zero] : nonZero;
    this.currentNavIndex = -1;

    // Create decorations ONCE — these IDs persist for the entire session
    this.createDecorations();

    // Content changes — mirrored placeholders
    try {
      const d = this.editor.onDidChangeModelContent((e: any) => { this.handleContentChange(e); });
      this.disposables.push({ dispose: () => d?.dispose?.() });
    } catch { /* ignore */ }

    // Selection changes — detect click-outside
    try {
      const d = this.editor.onDidChangeCursorSelection((e: any) => { this.handleSelectionChange(e); });
      this.disposables.push({ dispose: () => d?.dispose?.() });
    } catch { /* ignore */ }

    // Editor blur — detect focus loss
    try {
      const domNode = this.editor.getDomNode?.();
      if (domNode) {
        const blurHandler = () => { this.destroy(); };
        domNode.addEventListener('blur', blurHandler, true);
        this.disposables.push({ dispose: () => domNode.removeEventListener('blur', blurHandler, true) });
      }
    } catch { /* ignore */ }
  }

  advance(): boolean {
    if (this.destroyed || !this.editor) return true;
    const nextIndex = this.currentNavIndex + 1;
    if (nextIndex >= this.navigationOrder.length) {
      this.destroy();
      return true;
    }
    this.currentNavIndex = nextIndex;
    if (!this.moveToTabstop(this.navigationOrder[nextIndex])) {
      this.destroy();
      return true;
    }
    this.highlightActiveTabstop();
    return false;
  }

  retreat(): boolean {
    if (this.destroyed || !this.editor) return true;
    if (this.currentNavIndex <= 0) return true;
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

  isAtLastTabstop(): boolean {
    if (this.destroyed || !this.editor) return false;
    if (this.currentNavIndex < 0) return false;
    return this.currentNavIndex >= this.navigationOrder.length - 1;
  }

  /** Check if current nav index points to the final item in navigation order. */
  currentNavIsLast(): boolean {
    if (this.destroyed) return false;
    const last = this.navigationOrder.length - 1;
    return this.currentNavIndex >= last;
  }

  getLastTabstopIndex(): number {
    if (this.navigationOrder.length === 0) return -1;
    return this.navigationOrder[this.navigationOrder.length - 1].index;
  }

  /** Check if cursor is within the currently active tabstop. */
  isCursorInActiveTabstop(cursor: { line: number; column: number }): boolean {
    if (this.destroyed || !this.editor) return false;
    if (this.currentNavIndex < 0 || this.currentNavIndex >= this.navigationOrder.length) return false;
    const ts = this.navigationOrder[this.currentNavIndex];
    const r = this.getLiveRange(ts);
    if (!r) return false;
    const cursorLine = cursor.line + 1;
    const cursorCol = cursor.column + 1;
    const inRange =
      cursorLine >= r.startLineNumber && cursorLine <= r.endLineNumber &&
      cursorCol >= r.startColumn && cursorCol <= r.endColumn;
    // Also check if cursor is right at the end of the range (common when typing)
    if (!inRange && cursorLine === r.endLineNumber && cursorCol === r.endColumn + 1) {
      return true;
    }
    return inRange;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try { this.onDestroy?.(); } catch { /* ignore */ }

    if (this.editor && this.decorationIds.length > 0) {
      try { this.editor.deltaDecorations(this.decorationIds, []); } catch { /* ignore */ }
    }
    this.decorationIds = [];

    for (const d of this.disposables) {
      try { d.dispose(); } catch { /* ignore */ }
    }
    this.disposables = [];
    this.editor = null;
  }

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
    } catch { /* ignore */ }
    return null;
  }

  private validateDecorations(): boolean {
    if (this.destroyed) return true;
    if (this.decorationIds.length === 0) { this.destroy(); return true; }

    const model = this.editor?.getModel?.();
    if (!model) { this.destroy(); return true; }

    for (let i = 0; i < this.decorationIds.length; i++) {
      try {
        const range = model.getDecorationRange(this.decorationIds[i]);
        if (!range) { this.destroy(); return true; }
      } catch { this.destroy(); return true; }
    }
    return false;
  }

  private handleContentChange(_e: any): void {
    if (this.destroyed || !this.editor || this.isMirrorUpdating) return;
    if (this.validateDecorations()) return;
    if (this.currentNavIndex < 0 || this.currentNavIndex >= this.navigationOrder.length) return;

    const current = this.navigationOrder[this.currentNavIndex];
    if (current.index === 0) return;

    const siblings = this.tabstops.filter((t) => t.index === current.index && t !== current);
    if (siblings.length === 0) return;

    const model = this.editor.getModel();
    if (!model) return;

    let currentText: string;
    try {
      const range = this.getLiveRange(current);
      if (!range) return;
      currentText = model.getValueInRange(range);
    } catch { return; }

    this.isMirrorUpdating = true;
    try {
      const edits: any[] = [];
      for (const s of siblings) {
        const sr = this.getLiveRange(s);
        if (sr) edits.push({ range: sr, text: currentText });
      }
      if (edits.length > 0) {
        this.editor.executeEdits('codehelper-snippet-mirror', edits);
      }
    } catch { /* ignore */ }
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

      const onTabstop = this.tabstops.some((ts) => {
        const r = this.getLiveRange(ts);
        if (!r) return false;
        return cursorLine >= r.startLineNumber && cursorLine <= r.endLineNumber;
      });
      if (!onTabstop) {
        this.destroy();
      }
    } catch { /* ignore */ }
  }

  private moveToTabstop(ts: TabstopInfo): boolean {
    if (!this.editor) return false;
    try {
      const range = this.getLiveRange(ts);
      if (!range) return false;
      this.editor.setSelection(range);
      this.editor.revealRangeInCenter(range);
      return true;
    } catch { return false; }
  }

  private createDecorations(): void {
    if (!this.editor) return;
    try {
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
      this.decorationIds = this.editor.deltaDecorations([], decorations);
    } catch { /* ignore */ }
  }

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
          const liveRange = model.getDecorationRange(this.decorationIds[i]);
          if (!liveRange) continue;
          changeAccessor.changeDecoration(this.decorationIds[i], liveRange, {
            inlineClassName: isActive ? 'ch-snippet-placeholder-active' : 'ch-snippet-placeholder',
            stickiness: 1,
            showIfCollapsed: true,
          });
        }
      });
    } catch { /* ignore */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SnippetEngine
// ─────────────────────────────────────────────────────────────────────────────

export class SnippetEngine {
  private adapter: EditorAdapter;
  private settings: SnippetSettings;
  private state: EngineState = EngineState.IDLE;
  private session: SnippetSession | null = null;

  private disposables: Array<Disposable> = [];
  private domHandler: ((e: KeyboardEvent) => void) | null = null;
  private editorBubbleHandler: ((e: KeyboardEvent) => void) | null = null;

  private suggestWidget: SnippetSuggestWidget;

  /** Timestamp when state was set to EXPANDING — used for stale recovery. */
  private expandSince = 0;
  /** Timer ID for clearing EXPANDING state after timeout. */
  private expandSafetyTimer: number | null = null;

  /** Post-accept suppression: don't show widget for N ms after accepting. */
  private suppressUntil = 0;

  /** Identifier index for local autocomplete. */
  private identifierIndex = new IdentifierIndex();
  /** Debounce timer for re-indexing. */
  private rebuildTimer: number | null = null;

  /** Single update timer — only one pending at a time. */
  private updateTimer: number | null = null;

  /** Language detected for VS Code snippets. Updated in updateSettings. */
  private detectedLang: string;

  /** Track whether content listener has been set up. */
  private contentDisposable: Disposable | null = null;
  private cursorDisposable: Disposable | null = null;

  constructor(adapter: EditorAdapter, settings: SnippetSettings) {
    this.adapter = adapter;
    this.settings = settings;
    this.suggestWidget = new SnippetSuggestWidget(adapter);
    this.detectedLang = detectLanguage(adapter);

    // Preload ALL VS Code snippets synchronously (static imports, inlined by Vite)
    preloadAll();

    this.registerDomFallback();
    this.registerContentListener();
    this.registerCursorListener();
    this.registerUndoListener();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DOM KEY HANDLER (capture phase)
  // ═══════════════════════════════════════════════════════════════════════════

  private registerDomFallback(): void {
    this.domHandler = (e: KeyboardEvent) => {
      try {
        if (!e?.key) return;

        // Only keys we care about
        if (e.key !== 'Tab' && e.key !== 'Escape' && e.key !== 'ArrowDown' &&
            e.key !== 'ArrowUp' && e.key !== 'Enter') return;

        const rootEl = this.adapter.getRootElement();
        if (!rootEl || !rootEl.contains(e.target as Node)) return;

        // ═════════════════════════════════════════════════════════════════
        // SUGGESTION WIDGET KEY HANDLING
        // ═════════════════════════════════════════════════════════════════
        if (this.suggestWidget.visible) {
          if (e.key === 'ArrowDown') {
            this.suggestWidget.selectNext();
            e.preventDefault(); e.stopPropagation(); return;
          }
          if (e.key === 'ArrowUp') {
            this.suggestWidget.selectPrev();
            e.preventDefault(); e.stopPropagation(); return;
          }
          if (e.key === 'Escape') {
            this.hideWidget();
            e.preventDefault(); e.stopPropagation(); return;
          }

          // Tab — primary accept, ALWAYS expand even if nothing selected
          if (e.key === 'Tab' && !e.shiftKey) {
            const selected = this.suggestWidget.getSelected();
            if (selected) {
              this.hideWidget();
              this.suppressUntil = Date.now() + 150;
              if ('type' in selected && 'name' in selected) {
                this.insertIdentifier(selected as IdentifierSuggestion);
              } else {
                const sm = selected as SnippetMatch;
                this.expandSnippetFromWidget(sm.snippet, sm.prefix);
              }
            } else {
              // Nothing selected — try Tab-expand anyway
              this.hideWidget();
              const trigger = this.findTriggerWord();
              if (trigger) {
                this.expandSnippet(trigger);
              }
              // else fall through to native Tab
            }
            e.preventDefault(); e.stopPropagation(); return;
          }

          // Enter — secondary accept
          if (e.key === 'Enter') {
            const selected = this.suggestWidget.getSelected();
            if (selected) {
              this.hideWidget();
              this.suppressUntil = Date.now() + 150;
              if ('type' in selected && 'name' in selected) {
                this.insertIdentifier(selected as IdentifierSuggestion);
              } else {
                const sm = selected as SnippetMatch;
                this.expandSnippetFromWidget(sm.snippet, sm.prefix);
              }
              e.preventDefault(); e.stopPropagation(); return;
            }
            // No selection (widget visible but nothing selected) — 
            // hide widget, clear items, let Enter insert newline normally
            this.suggestWidget.clearItems();
            this.hideWidget();
            return; // Don't preventDefault — let Monaco handle newline
          }
        }

        // ═════════════════════════════════════════════════════════════════
        // ACTIVE SNIPPET SESSION NAVIGATION
        // ═════════════════════════════════════════════════════════════════
        if (this.state === EngineState.SESSION && this.session?.isActive()) {
          if (e.key === 'Escape') {
            this.destroySession();
            this.scheduleUpdate();
            e.preventDefault(); e.stopPropagation(); return;
          }
          if (e.key === 'Tab' && !e.shiftKey) {
            const done = this.session.advance();
            if (done) {
              // Session ended (was at last tabstop).
              this.destroySession();
              this.scheduleUpdate();
              // Don't return — fall through to the IDLE Tab handler below
              // which will call findTriggerWord() and expand.
            } else {
              e.preventDefault(); e.stopPropagation(); return;
            }
          }
          if (e.key === 'Tab' && e.shiftKey) {
            const done = this.session.retreat();
            if (done) {
              this.destroySession();
              this.scheduleUpdate();
            }
            e.preventDefault(); e.stopPropagation(); return;
          }
          return;
        }

        // ═════════════════════════════════════════════════════════════════
        // TAB — expand snippet from trigger word
        // ═════════════════════════════════════════════════════════════════
        if (e.key === 'Tab' && !e.shiftKey && this.state === EngineState.IDLE) {
          const trigger = this.findTriggerWord();
          if (trigger) {
            this.expandSnippet(trigger);
            e.preventDefault(); e.stopPropagation(); return;
          }
          // No trigger — allow Monaco to handle Tab (native indent, etc.)
          return;
        }
      } catch (err) {
        console.warn('[CodeHelper] Snippet DOM handler threw:', err);
      }
    };

    document.addEventListener('keydown', this.domHandler, { capture: true });

    // Bubble-phase fallback: clean up Monaco-inserted tab characters
    this.editorBubbleHandler = (e: KeyboardEvent) => {
      try {
        if (e?.key !== 'Tab' || e.shiftKey) return;
        if (this.state !== EngineState.SESSION || !this.session?.isActive()) return;
        const rootEl = this.adapter.getRootElement();
        if (!rootEl || !rootEl.contains(e.target as Node)) return;

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
      } catch { /* ignore */ }
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
  //  CONTENT & CURSOR LISTENERS → single scheduleUpdate
  // ═══════════════════════════════════════════════════════════════════════════

  private registerContentListener(): void {
    const disposable = this.adapter.onDidChangeContent(() => {
      // ── Auto-finish last tabstop ──────────────────────────────────
      // Only destroy if the cursor actually LEFT the last placeholder range
      // (i.e., user clicked/moved outside, not typing inside it).
      // Typing inside the final placeholder should keep the session alive
      // so snippet suggestions still work.
      if (this.session?.isActive() && this.session.isAtLastTabstop()) {
        const cursor = this.adapter.getCursorPosition();
        if (!cursor) {
          this.destroySession();
        } else {
          // Check if cursor is still within any tabstop range
          const stillInPlaceholder = this.session.isCursorInActiveTabstop(cursor);
          if (!stillInPlaceholder) {
            this.destroySession();
          }
          // If still in placeholder, keep session alive
        }
      }

      // ── Rebuild identifier index on debounce ───────────────────────
      if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
      this.rebuildTimer = window.setTimeout(() => {
        this.rebuildIdentifierIndex();
        this.rebuildTimer = null;
      }, 200);

      this.scheduleUpdate();
    });
    this.contentDisposable = disposable;
    this.disposables.push(disposable);
  }

  private registerCursorListener(): void {
    const disposable = this.adapter.onDidChangeCursorSelection(() => {
      this.scheduleUpdate();
    });
    this.cursorDisposable = disposable;
    this.disposables.push(disposable);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  UNDO LISTENER — force clean state on undo
  // ═══════════════════════════════════════════════════════════════════════════

  private registerUndoListener(): void {
    const handler = (e: KeyboardEvent) => {
      const isUndo = (e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey;
      if (!isUndo) return;
      const rootEl = this.adapter.getRootElement();
      if (!rootEl || !rootEl.contains(e.target as Node)) return;

      if (this.state !== EngineState.IDLE || (this.session?.isActive())) {
        this.forceCleanState();
        this.scheduleUpdate();
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    this.disposables.push({
      dispose: () => document.removeEventListener('keydown', handler, { capture: true }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CENTRALIZED UPDATE — SINGLE SOURCE OF TRUTH
  // ═══════════════════════════════════════════════════════════════════════════

  private scheduleUpdate(): void {
    if (this.updateTimer !== null) return;
    this.updateTimer = window.setTimeout(() => {
      this.updateTimer = null;
      this.performUpdate();
    }, 15); // Slightly longer to coalesce more rapid events
  }

  private performUpdate(): void {
    // ── Stale EXPANDING recovery ─────────────────────────────────────
    if (this.state === EngineState.EXPANDING) {
      const elapsed = Date.now() - this.expandSince;
      if (elapsed > 3000 || this.expandSince === 0) {
        this.state = EngineState.IDLE;
        this.clearExpandSafetyTimer();
      }
    }

    // ── Expansion in progress — keep widget hidden ───────────────────
    if (this.state === EngineState.EXPANDING) {
      if (this.suggestWidget.visible) this.suggestWidget.hide();
      return;
    }

    // ── Post-accept suppression ──────────────────────────────────────
    if (Date.now() < this.suppressUntil) {
      if (this.suggestWidget.visible) this.suggestWidget.hide();
      return;
    }
    this.suppressUntil = 0;

    // ── Stale session cleanup ────────────────────────────────────────
    if (this.state === EngineState.SESSION && !this.session?.isActive()) {
      this.destroySession();
    }

    // ── Active snippet session — show widget for last tabstop only ──
    if (this.state === EngineState.SESSION && this.session?.isActive()) {
      if (!this.session.isAtLastTabstop() && !this.session.currentNavIsLast()) {
        // Non-last tabstop: keep widget hidden
        if (this.suggestWidget.visible) this.suggestWidget.hide();
        return;
      }
      // Last tabstop: fall through to compute and show matches below
    }

    // ── Compute and show widget ──────────────────────────────────────
    const cursor = this.adapter.getCursorPosition();
    if (!cursor) { this.hideWidget(); return; }

    const line = this.adapter.getLine(cursor.line);
    if (typeof line !== 'string') { this.hideWidget(); return; }

    const textBeforeCursor = line.substring(0, cursor.column);
    if (!textBeforeCursor) { this.hideWidget(); return; }

    // ── State safety: if we're somehow still SESSION but not at last tabstop,
    //     force clean state (safety net for race conditions) ──────────
    if (this.state === EngineState.SESSION && this.session?.isActive()) {
      // Already checked above — this path means we're at last tabstop
      // which is fine, widget can show
    } else if (this.state === EngineState.SESSION) {
      this.destroySession();
    }

    const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
    const currentWord = wordMatch ? wordMatch[1] : '';
    if (currentWord.length === 0) { this.hideWidget(); return; }

    const matches = this.computeMatches(currentWord, cursor.line);
    if (matches.length > 0) {
      this.suggestWidget.show(matches, cursor.line, cursor.column);
    } else {
      this.hideWidget();
    }
  }

  /**
   * Public: programmatically hide the suggestion widget and suppress re-show
   * for a brief period. Used after snippet expansion.
   */
  suppressWidget(): void {
    this.suppressUntil = Date.now() + 200;
    this.hideWidget();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MATCH COMPUTATION
  // ═══════════════════════════════════════════════════════════════════════════

  private computeMatches(currentWord: string, cursorLine: number): SuggestionItem[] {
    const allSnippets = this.getAllSnippets();
    const snippetMatches: Array<{ snippet: Snippet; prefix: string }> = [];
    const seenPrefixes = new Set<string>();

    for (const snippet of allSnippets) {
      if (!snippet?.prefix) continue;
      if (!snippet.body || typeof snippet.body !== 'string') continue;

      for (const prefix of snippet.prefix) {
        if (!prefix || typeof prefix !== 'string' || prefix.length === 0) continue;
        if (seenPrefixes.has(prefix)) continue;

        if (prefix.startsWith(currentWord)) {
          seenPrefixes.add(prefix);
          snippetMatches.push({ snippet, prefix });
        }
      }
    }

    // Sort snippet matches: exact matches first, then by prefix length desc
    snippetMatches.sort((a, b) => {
      const aExact = a.prefix === currentWord ? 1 : 0;
      const bExact = b.prefix === currentWord ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      if (a.prefix.length !== b.prefix.length) return b.prefix.length - a.prefix.length;
      const cmp = a.prefix.localeCompare(b.prefix);
      if (cmp !== 0) return cmp;
      return (a.snippet.body?.length ?? 0) - (b.snippet.body?.length ?? 0);
    });

    // ── Identifier matches ───────────────────────────────────────────
    const identifierMatches = this.identifierIndex.getMatches(currentWord, cursorLine);
    const identItems: IdentifierSuggestion[] = identifierMatches.map((im) => {
      const plen = Math.min(im.symbol.name.length, currentWord.length + 5);
      return {
        name: im.symbol.name,
        type: im.symbol.type,
        scope: im.symbol.scope,
        description: `${im.symbol.type} · ${im.symbol.scope} · line ${im.symbol.line + 1}`,
        prefix: im.symbol.name.substring(0, plen),
      };
    });

    const seenIdent = new Set<string>();
    const dedupedIdent = identItems.filter((item) => {
      if (seenIdent.has(item.name)) return false;
      seenIdent.add(item.name);
      return true;
    });

    // ── Merge: identifiers before snippets, exact before partial ─────
    const merged: SuggestionItem[] = [];

    // Phase 1: Exact identifier matches
    for (const item of dedupedIdent) {
      if (item.name === currentWord) merged.push(item);
    }
    // Phase 2: Exact snippet matches
    for (const sm of snippetMatches) {
      if (sm.prefix === currentWord) merged.push(sm);
    }
    // Phase 3: Local-scope identifier prefix matches
    for (const item of dedupedIdent) {
      if (item.name !== currentWord && (item.scope === 'local' || item.scope === 'function')) {
        merged.push(item);
      }
    }
    // Phase 4: Snippet prefix matches
    for (const sm of snippetMatches) {
      if (sm.prefix !== currentWord) merged.push(sm);
    }
    // Phase 5: Other identifiers
    for (const item of dedupedIdent) {
      if (item.name !== currentWord && item.scope !== 'local' && item.scope !== 'function') {
        if (!merged.some((m) => 'name' in m && (m as IdentifierSuggestion).name === item.name)) {
          merged.push(item);
        }
      }
    }

    return merged.slice(0, 20);
  }

  private hideWidget(): void {
    this.suggestWidget.hide();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  IDENTIFIER INDEX
  // ═══════════════════════════════════════════════════════════════════════════

  private rebuildIdentifierIndex(): void {
    try {
      const content = this.adapter.getValue();
      if (!content || content.length === 0) return;
      const lang = detectLanguage(this.adapter);
      if (lang === 'unknown') return;
      const cursor = this.adapter.getCursorPosition();
      const cursorLine = cursor ? cursor.line : 0;
      if (this.identifierIndex.hasContentChanged(content, lang)) {
        this.identifierIndex.rebuild(content, lang, cursorLine);
      }
    } catch { /* best-effort */ }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SINGLE EXPANSION CODE PATH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Core expansion logic shared by expandTrigger (widget) and expandSnippet (Tab).
   * Replaces the trigger word with the snippet body and creates a SnippetSession.
   */
  private doExpand(snippet: Snippet, triggerLength: number): void {
    this.state = EngineState.EXPANDING;
    this.expandSince = Date.now();
    this.startExpandSafetyTimer();
    try {
      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return;

      const lineContent = this.adapter.getLine(cursor.line);
      const textBeforeCursor = typeof lineContent === 'string'
        ? lineContent.substring(0, cursor.column) : '';
      const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
      const currentWord = wordMatch ? wordMatch[1] : '';

      const baseIndent = typeof lineContent === 'string'
        ? (lineContent.match(/^[\t ]*/)?.[0] ?? '') : '';

      const triggerStart = {
        line: cursor.line,
        column: cursor.column - (currentWord.length || triggerLength),
      };

      if (!snippet.body || typeof snippet.body !== 'string') return;
      const parsed = parseSnippet(snippet.body);
      if (!parsed || !Array.isArray(parsed.segments)) return;

      const resolved = this.resolveSegments(parsed.segments);
      if (!resolved) return;

      const adjusted = this.applyBodyIndentation(
        resolved.text, resolved.tabstops, baseIndent, triggerStart.line,
      );
      const finalText = adjusted?.text ?? resolved.text;
      const finalTabstops = adjusted?.tabstops ?? resolved.tabstops;

      // ── Replace the trigger word with the snippet body ─────────────
      this.adapter.replaceRange({ start: triggerStart, end: cursor }, finalText);

      // ── Create session with tabstops ───────────────────────────────
      if (Array.isArray(finalTabstops) && finalTabstops.length > 0) {
        const absoluteTabstops: TabstopInfo[] = [];
        const insertPos = triggerStart;
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

        if (this.session) { this.session.destroy(); this.session = null; }

        this.session = new SnippetSession(this.adapter, absoluteTabstops, () => {
          this.session = null;
          if (this.state === EngineState.SESSION) {
            this.state = EngineState.IDLE;
            this.scheduleUpdate();
          }
        });

        if (this.session.isActive()) {
          this.state = EngineState.SESSION;
          this.session.advance();
        } else {
          this.session = null;
          const first = absoluteTabstops.find((t) => t.index > 0) ?? absoluteTabstops[0];
          if (first) {
            this.adapter.setCursorPosition({ line: first.line, column: first.column });
          }
        }
      }
    } catch (err) {
      console.warn('[CodeHelper] expandSnippet threw:', err);
      if (this.session) { this.session.destroy(); this.session = null; }
    } finally {
      if (this.state === EngineState.EXPANDING) {
        this.state = this.session?.isActive() ? EngineState.SESSION : EngineState.IDLE;
      }
      this.clearExpandSafetyTimer();
      this.scheduleUpdate();
    }
  }

  /** Called when user selects a snippet from the widget. */
  private expandSnippetFromWidget(snippet: Snippet, prefix: string): void {
    this.doExpand(snippet, prefix.length);
  }

  /** Called when user presses Tab with a trigger word. */
  private expandSnippet(trigger: SnippetTrigger): void {
    const { snippet, triggerLength } = trigger;
    this.doExpand(snippet, triggerLength);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  IDENTIFIER INSERTION
  // ═══════════════════════════════════════════════════════════════════════════

  private insertIdentifier(ident: IdentifierSuggestion): void {
    this.state = EngineState.EXPANDING;
    this.expandSince = Date.now();
    this.startExpandSafetyTimer();
    try {
      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return;

      const lineContent = this.adapter.getLine(cursor.line);
      const textBeforeCursor = typeof lineContent === 'string'
        ? lineContent.substring(0, cursor.column) : '';
      const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
      const currentWord = wordMatch ? wordMatch[1] : '';
      const triggerLength = currentWord.length;
      if (triggerLength === 0) return;

      const triggerStart = { line: cursor.line, column: cursor.column - triggerLength };
      this.adapter.replaceRange({ start: triggerStart, end: cursor }, ident.name);
      this.identifierIndex.recordUsage(ident.name);

      this.suppressUntil = Date.now() + 50;
    } catch (err) {
      console.warn('[CodeHelper] insertIdentifier threw:', err);
    } finally {
      this.state = EngineState.IDLE;
      this.clearExpandSafetyTimer();
      this.scheduleUpdate();
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

      const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
      const currentWord = wordMatch ? wordMatch[1] : '';
      if (currentWord.length === 0) return null;

      const allSnippets = this.getAllSnippets();
      if (!Array.isArray(allSnippets) || allSnippets.length === 0) return null;

      let bestMatch: SnippetTrigger | null = null;
      let bestPrefixLength = 0;

      for (const snippet of allSnippets) {
        if (!snippet || typeof snippet !== 'object') continue;
        if (!Array.isArray(snippet.prefix) || snippet.prefix.length === 0) continue;
        if (!snippet.body || typeof snippet.body !== 'string') continue;

        for (const prefix of snippet.prefix) {
          if (!prefix || typeof prefix !== 'string' || prefix.length === 0) continue;

          // Prefer exact matches, then longest prefix match
          if (prefix === currentWord) {
            if (!bestMatch || prefix.length > bestPrefixLength) {
              bestMatch = { snippet, triggerLength: currentWord.length };
              bestPrefixLength = prefix.length;
            }
          } else if (!bestMatch || bestMatch.triggerLength !== currentWord.length) {
            // Only consider non-exact matches if no exact match found
            if (prefix.startsWith(currentWord) && prefix.length > bestPrefixLength) {
              bestMatch = { snippet, triggerLength: currentWord.length };
              bestPrefixLength = prefix.length;
            }
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
  //  SEGMENT RESOLVER
  // ═══════════════════════════════════════════════════════════════════════════

  private resolveSegments(segments: Array<{
    type: string; value?: string; index?: number; children?: any[];
  }>): { text: string; tabstops: Array<any> } | null {
    try {
      if (!Array.isArray(segments)) return null;
      let text = '';
      const tabstops: Array<any> = [];
      let currentLine = 0;
      let currentColumn = 0;

      for (const segment of segments) {
        if (!segment || typeof segment !== 'object') continue;

        if (segment.type === 'text') {
          const value = typeof segment.value === 'string' ? segment.value : '';
          text += value;
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
            index, line: currentLine, column: currentColumn,
            length: placeholder.length, placeholder, lineCount: 0,
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
  //  BODY INDENTATION — match VS Code behavior
  // ═══════════════════════════════════════════════════════════════════════════

  private applyBodyIndentation(
    text: string, relativeTabstops: Array<any>,
    baseIndent: string, _insertLine: number,
  ): { text: string; tabstops: Array<any> } | null {
    const lines = text.split('\n');
    if (lines.length <= 1) return null;

    let indentUnit = '\t';
    let tabSize = 4;
    try {
      const monacoEditor = (this.adapter as any).getMonacoEditor?.();
      if (monacoEditor) {
        const model = monacoEditor.getModel?.();
        if (model && typeof model.getOptions === 'function') {
          const opts = model.getOptions();
          if (opts) {
            tabSize = opts.tabSize ?? 4;
            if (opts.insertSpaces ?? true) indentUnit = ' '.repeat(tabSize);
          }
        } else if (monacoEditor.getOption) {
          const insertSpaces = monacoEditor.getOption(50) ?? true;
          tabSize = monacoEditor.getOption(49) ?? 4;
          if (insertSpaces) indentUnit = ' '.repeat(tabSize);
        }
      }
    } catch { /* fallback */ }

    // VS Code behavior: each \t in a snippet body = one indent level
    // relative to the cursor line's base indentation.
    // minTabs subtraction is WRONG — it breaks snippets like "if" where
    // the second line has \t${0:pass} which should indent one level.
    const processedLines: string[] = [];
    const lineExtra: number[] = new Array(lines.length).fill(0);

    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        // First line: keep as-is (it's at the cursor position)
        processedLines.push(lines[i]);
        continue;
      }

      const raw = lines[i];
      let tabCount = 0;
      while (tabCount < raw.length && raw[tabCount] === '\t') tabCount++;

      if (tabCount === 0) {
        // No indentation in snippet — just use base indent
        const indent = baseIndent;
        const rest = raw;
        processedLines.push(indent + rest);
        lineExtra[i] = indent.length;
      } else {
        // Each \t becomes one indentUnit relative to baseIndent
        const indent = baseIndent + indentUnit.repeat(tabCount);
        const rest = raw.substring(tabCount);
        processedLines.push(indent + rest);
        lineExtra[i] = indent.length - tabCount;
      }
    }

    const adjustedTabstops = relativeTabstops.map((ts) => {
      let colShift = 0;
      for (let i = 0; i <= ts.line && i < lineExtra.length; i++) colShift += lineExtra[i];
      return { ...ts, column: ts.column + colShift };
    });

    return { text: processedLines.join('\n'), tabstops: adjustedTabstops };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SNIPPET COLLECTION
  // ═══════════════════════════════════════════════════════════════════════════

  private getAllSnippets(): Snippet[] {
    const builtins = Array.isArray(BUILTIN_SNIPPETS) ? BUILTIN_SNIPPETS : [];
    const custom = Array.isArray(this.settings.customSnippets) ? this.settings.customSnippets : [];
    const vsCodeSnippets = getCachedSnippets(this.detectedLang);
    const all = [...builtins, ...custom, ...vsCodeSnippets];

    const currentLang = detectLanguage(this.adapter);

    // If we can detect the language from the editor model, use it.
    // Otherwise fall back to what was detected at construction time.
    const lang = currentLang !== 'unknown' ? currentLang : this.detectedLang;

    // Deduplicate by prefix (builtins take priority)
    const seen = new Set<string>();
    return all.filter((snippet) => {
      if (!snippet.language || !Array.isArray(snippet.language)) return true;
      if (snippet.language.includes('*') || snippet.language.includes(lang)) {
        const key = snippet.prefix.join(',');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }
      return false;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  STATE MANAGEMENT HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private destroySession(): void {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
    this.state = EngineState.IDLE;
    this.clearExpandSafetyTimer();
  }

  private forceCleanState(): void {
    this.destroySession();
    this.state = EngineState.IDLE;
    this.clearExpandSafetyTimer();
    this.suppressUntil = 0;
    this.hideWidget();
  }

  private clearExpandSafetyTimer(): void {
    if (this.expandSafetyTimer !== null) {
      clearTimeout(this.expandSafetyTimer);
      this.expandSafetyTimer = null;
    }
  }

  private startExpandSafetyTimer(): void {
    this.clearExpandSafetyTimer();
    this.expandSafetyTimer = window.setTimeout(() => {
      this.expandSafetyTimer = null;
      if (this.state === EngineState.EXPANDING) {
        console.warn('[CodeHelper] Expansion safety timeout — resetting state');
        this.state = EngineState.IDLE;
        this.scheduleUpdate();
      }
    }, 3000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  updateSettings(settings: SnippetSettings): void {
    this.settings = settings;
    this.detectedLang = detectLanguage(this.adapter);
    preloadAll();
    this.forceCleanState();
  }

  dispose(): void {
    this.destroySession();
    this.suggestWidget.destroy();
    this.clearExpandSafetyTimer();

    if (this.domHandler) {
      try { document.removeEventListener('keydown', this.domHandler, { capture: true }); } catch { /* ignore */ }
      this.domHandler = null;
    }

    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    for (const d of this.disposables) {
      try { d.dispose(); } catch { /* ignore */ }
    }
    this.disposables = [];
  }
}
