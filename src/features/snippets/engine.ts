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
  private tabstops: TabstopInfo[] = [];
  /** Tabstops sorted by index (excluding $0 from middle, $0 always last). */
  private navigationOrder: TabstopInfo[] = [];
  /** Index into navigationOrder. -1 = before first. */
  private currentNavIndex = -1;
  private activeDecorationIds: string[] = [];
  private disposables: Array<{ dispose(): void }> = [];
  private isMirrorUpdating = false;
  private destroyed = false;
  private editorId = '';

  constructor(adapter: EditorAdapter, tabstops: TabstopInfo[]) {
    // Get raw Monaco editor for decorations, events, and fine-grained control
    this.editor = (adapter as any).getMonacoEditor?.();
    if (!this.editor) {
      this.destroyed = true;
      return;
    }
    this.editorId = typeof this.editor.getId === 'function' ? this.editor.getId() : '';

    // Store all tabstops
    this.tabstops = tabstops;

    // Build navigation order: numeric indices > 0 sorted ascending,
    // then $0 (index 0) at the very end if present
    const nonZero = [...tabstops].filter((t) => t.index > 0).sort((a, b) => a.index - b.index);
    const zero = tabstops.find((t) => t.index === 0);
    this.navigationOrder = zero ? [...nonZero, zero] : nonZero;
    this.currentNavIndex = -1;

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

    // Highlight all placeholders immediately
    this.updateDecorations();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Advance to the next tabstop. Returns false if snippet navigation handled, true to fall through. */
  advance(): boolean {
    if (this.destroyed || !this.editor) return true;

    const nextIndex = this.currentNavIndex + 1;
    if (nextIndex >= this.navigationOrder.length) {
      // After the last placeholder — exit snippet mode
      this.destroy();
      return true; // Let Tab fall through to normal behaviour
    }

    this.currentNavIndex = nextIndex;
    this.moveToTabstop(this.navigationOrder[nextIndex]);
    this.updateDecorations();
    return false;
  }

  /** Go back to the previous tabstop. Returns false if handled, true to fall through. */
  retreat(): boolean {
    if (this.destroyed || !this.editor) return true;

    if (this.currentNavIndex <= 0) {
      // At first placeholder — let Shift+Tab do its normal thing
      return true;
    }

    this.currentNavIndex--;
    this.moveToTabstop(this.navigationOrder[this.currentNavIndex]);
    this.updateDecorations();
    return false;
  }

  /** Check whether this session targets the given editor. */
  isForEditor(editorId: string): boolean {
    return this.editorId === editorId;
  }

  /** Whether the session is still active. */
  isActive(): boolean {
    return !this.destroyed;
  }

  /** Force-exit the snippet session. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Remove decorations
    if (this.editor && typeof this.editor.deltaDecorations === 'function') {
      try {
        this.editor.deltaDecorations(this.activeDecorationIds, []);
      } catch {
        // ignore
      }
    }
    this.activeDecorationIds = [];

    // Dispose event listeners
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

  // ── Event handlers ──────────────────────────────────────────────────────

  private handleContentChange(e: any): void {
    if (this.destroyed || !this.editor || this.isMirrorUpdating) return;
    if (this.currentNavIndex < 0 || this.currentNavIndex >= this.navigationOrder.length) return;

    const current = this.navigationOrder[this.currentNavIndex];
    // We only mirror for indices > 0 (not $0)
    if (current.index === 0) return;

    // Find all siblings with the same index (excluding the active one)
    const siblings = this.tabstops.filter((t) => t.index === current.index && t !== current);
    if (siblings.length === 0) return;

    const model = this.editor.getModel();
    if (!model) return;

    // Read the current text at the active placeholder range
    let currentText: string;
    try {
      currentText = model.getValueInRange({
        startLineNumber: current.line + 1,
        startColumn: current.column + 1,
        endLineNumber: current.line + 1 + (current.lineCount ?? 0),
        endColumn: current.column + 1 + current.length,
      });
    } catch {
      return;
    }

    // Apply the same text to all sibling placeholders
    this.isMirrorUpdating = true;
    try {
      this.editor.executeEdits(
        'codehelper-snippet-mirror',
        siblings.map((s) => ({
          range: {
            startLineNumber: s.line + 1,
            startColumn: s.column + 1,
            endLineNumber: s.line + 1 + (s.lineCount ?? 0),
            endColumn: s.column + 1 + s.length,
          },
          text: currentText,
        })),
      );
    } catch {
      // ignore mirror failures
    }
    this.isMirrorUpdating = false;
  }

  private handleSelectionChange(e: any): void {
    if (this.destroyed || !this.editor) return;
    if (this.currentNavIndex < 0 || this.currentNavIndex >= this.navigationOrder.length) return;

    try {
      const sel = this.editor.getSelection();
      if (!sel) return;
      const cursorLine = sel.positionLineNumber ?? sel.startLineNumber;

      // If cursor is on a line that doesn't contain any tabstop, exit
      const onTabstopLine = this.tabstops.some((ts) => cursorLine === ts.line + 1);
      if (!onTabstopLine) {
        this.destroy();
      }
    } catch {
      // ignore
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private moveToTabstop(ts: TabstopInfo): void {
    if (!this.editor) return;

    try {
      // Select the placeholder text so the user can type over it
      this.editor.setSelection({
        startLineNumber: ts.line + 1,
        startColumn: ts.column + 1,
        endLineNumber: ts.line + 1 + (ts.lineCount ?? 0),
        endColumn: ts.column + 1 + ts.length,
      });
      this.editor.revealPositionInCenter({
        positionLineNumber: ts.line + 1,
        positionColumn: ts.column + 1,
      });
    } catch {
      // ignore
    }
  }

  private updateDecorations(): void {
    if (!this.editor) return;

    try {
      const decorations = this.tabstops.map((ts) => {
        const navIdx = this.navigationOrder.indexOf(ts);
        const isActive = this.currentNavIndex >= 0 && navIdx === this.currentNavIndex;

        return {
          range: {
            startLineNumber: ts.line + 1,
            startColumn: ts.column + 1,
            endLineNumber: ts.line + 1 + (ts.lineCount ?? 0),
            endColumn: ts.column + 1 + ts.length,
          },
          options: {
            inlineClassName: isActive ? 'ch-snippet-placeholder-active' : 'ch-snippet-placeholder',
            stickiness: 1, // NeverGrowsWhenTypingAtEdges
          },
        };
      });

      this.activeDecorationIds = this.editor.deltaDecorations(
        this.activeDecorationIds,
        decorations,
      );
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
            // No selection — still consume the event to prevent Monaco from acting
            e.preventDefault();
            e.stopPropagation();
            return;
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
            if (!handled) {
              if (!this.session.isActive()) this.session = null;
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            this.session = null;
            return;
          }
          if (e.key === 'Tab' && e.shiftKey) {
            const handled = this.session.retreat();
            if (!handled) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            return;
          }
          return;
        }

        // ── No active session — expand snippet on Tab ──────────────────
        if (e.key === 'Tab' && !e.shiftKey) {
          const trigger = this.findTriggerWord();
          if (trigger) {
            console.log('[CodeHelper] DOM fallback: expanding snippet for', trigger.snippet.prefix);
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
      // Don't show widget during snippet expansion
      if (this.suppressWidget) return;
      if (this.session && this.session.isActive()) return;

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
      // Sort by relevance: longest prefix match first (more specific = better),
      // then alphabetically, then by body length (shorter body = simpler snippet).
      matches.sort((a, b) => {
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
   */
  private expandTrigger(snippet: Snippet, prefix: string): void {
    this.suppressWidget = true;
    try {
      const cursor = this.adapter.getCursorPosition();
      if (!cursor) return;

      const triggerLength = prefix.length;

      // Delete the trigger word
      const triggerStart = {
        line: cursor.line,
        column: cursor.column - triggerLength,
      };
      this.adapter.replaceRange({ start: triggerStart, end: cursor }, '');

      // Parse and resolve
      if (!snippet.body || typeof snippet.body !== 'string') return;
      const parsed = parseSnippet(snippet.body);
      if (!parsed || !Array.isArray(parsed.segments)) return;

      const resolved = this.resolveSegments(parsed.segments);
      if (!resolved) return;

      // Insert the expanded body at the same position
      const insertPos = {
        line: cursor.line,
        column: cursor.column - triggerLength,
      };
      this.adapter.replaceRange({ start: insertPos, end: insertPos }, resolved.text);

      // Set up tabstop navigation
      if (Array.isArray(resolved.tabstops) && resolved.tabstops.length > 0) {
        const absoluteTabstops: TabstopInfo[] = [];
        for (const ts of resolved.tabstops) {
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

        this.session = new SnippetSession(this.adapter, absoluteTabstops);

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
      // Use requestAnimationFrame for more reliable reset timing.
      // setTimeout(100) was unreliable because Monaco may fire content
      // change events after the timeout expires.
      requestAnimationFrame(() => {
        this.suppressWidget = false;
      });
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

      for (const snippet of allSnippets) {
        if (!snippet || typeof snippet !== 'object') continue;
        if (!Array.isArray(snippet.prefix) || snippet.prefix.length === 0) continue;
        if (!snippet.body || typeof snippet.body !== 'string') continue;

        for (const prefix of snippet.prefix) {
          if (!prefix || typeof prefix !== 'string' || prefix.length === 0) continue;

          // Prefix match: snippet prefix starts with what user typed
          if (prefix.startsWith(currentWord) && prefix.length > bestPrefixLength) {
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

      // Delete the trigger word
      const triggerStart = {
        line: cursor.line,
        column: cursor.column - triggerLength,
      };
      this.adapter.replaceRange({ start: triggerStart, end: cursor }, '');

      // Parse and resolve
      if (!snippet.body || typeof snippet.body !== 'string') return;
      const parsed = parseSnippet(snippet.body);
      if (!parsed || !Array.isArray(parsed.segments)) return;

      const resolved = this.resolveSegments(parsed.segments);
      if (!resolved) return;

      // Insert the expanded body at the same position
      const insertPos = {
        line: cursor.line,
        column: cursor.column - triggerLength,
      };
      this.adapter.replaceRange({ start: insertPos, end: insertPos }, resolved.text);

      // Set up tab-stop navigation
      if (Array.isArray(resolved.tabstops) && resolved.tabstops.length > 0) {
        // Convert relative tabstop positions to absolute positions
        const absoluteTabstops: TabstopInfo[] = [];
        for (const ts of resolved.tabstops) {
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
        this.session = new SnippetSession(this.adapter, absoluteTabstops);

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
