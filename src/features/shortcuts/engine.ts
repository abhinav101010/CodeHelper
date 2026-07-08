import type { EditorAdapter } from '../../adapters/types';
import type { ShortcutSettings } from '../../types/settings';
import { DEFAULT_SHORTCUTS } from './defaults';
import type { ShortcutDefinition } from '../../types/shortcuts';

function isMac(): boolean {
  try {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  } catch {
    return false;
  }
}

function getCommentString(language: string): string {
  const map: Record<string, string> = {
    cpp: '//',
    c: '//',
    java: '//',
    javascript: '//',
    js: '//',
    python: '#',
    python3: '#',
    go: '//',
    rust: '//',
  };
  return map[language] ?? '//';
}

/**
 * Checks if e.key is safe to use for shortcut matching.
 * Monaco IKeyboardEvent can have undefined or numeric key values.
 */
function isSafeKey(e: KeyboardEvent): boolean {
  if (!e) return false;
  if (typeof e.key !== 'string') return false;
  if (e.key.length === 0) return false;
  // Skip modifier-only keys — they should never trigger shortcuts
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].includes(e.key))
    return false;
  return true;
}

export class ShortcutEngine {
  private adapter: EditorAdapter;
  private settings: ShortcutSettings;
  private disposables: Array<{ dispose(): void }> = [];

  constructor(adapter: EditorAdapter, settings: ShortcutSettings) {
    this.adapter = adapter;
    this.settings = settings;
    this.registerShortcuts();
  }

  private registerShortcuts(): void {
    // Merge defaults with user overrides — ensure both are objects
    const defaults =
      DEFAULT_SHORTCUTS && typeof DEFAULT_SHORTCUTS === 'object' ? DEFAULT_SHORTCUTS : {};
    const userMappings =
      this.settings.mappings && typeof this.settings.mappings === 'object'
        ? this.settings.mappings
        : {};
    const shortcuts = { ...defaults, ...userMappings };

    // Guard: no shortcuts to register
    const entries = Object.entries(shortcuts);
    if (entries.length === 0) {
      console.log('[CodeHelper] ShortcutEngine: no shortcuts to register');
      return;
    }

    const disposable = this.adapter.onKeyDown((e: KeyboardEvent) => {
      try {
        // Skip matching entirely for keys that can't trigger shortcuts
        if (!isSafeKey(e)) return true;

        for (const [_id, def] of entries) {
          if (this.matchesShortcut(e, def)) {
            console.log('[CodeHelper] ShortcutEngine: executing', def.action);
            this.executeAction(def.action);
            return false;
          }
        }
      } catch (err) {
        console.warn('[CodeHelper] Shortcut handler threw:', err);
      }
      return true;
    });

    this.disposables.push(disposable);
    console.log('[CodeHelper] ShortcutEngine: registered', entries.length, 'shortcuts');
  }

  private matchesShortcut(e: KeyboardEvent, def: ShortcutDefinition): boolean {
    // ── Defensive guards ──────────────────────────────────────────────────
    // e.key is already validated by isSafeKey() before this is called.
    // But guard again in case this is called from elsewhere.

    // Guard: valid event
    if (!e || typeof e.key !== 'string') return false;

    // Guard: valid definition
    if (!def || typeof def !== 'object') return false;
    if (!def.keys || typeof def.keys !== 'object') return false;

    // Guard: keys must have both win/mac entries
    const macKey = def.keys.mac;
    const winKey = def.keys.win;

    if (typeof macKey !== 'string' && typeof winKey !== 'string') return false;

    const keyStr = isMac() ? macKey : winKey;

    // Guard: shortcut string must exist and be a non-empty string
    if (!keyStr || typeof keyStr !== 'string') return false;
    if (keyStr.length === 0) return false;

    // Parse the shortcut string (e.g., "Ctrl+Shift+K", "Cmd+D", "Tab")
    const parts = keyStr.split('+');
    if (parts.length === 0) return false;

    // Last part should be the main key (non-modifier)
    const lastPart = parts[parts.length - 1];
    if (!lastPart || typeof lastPart !== 'string') return false;
    if (lastPart.length === 0) return false;

    const key = lastPart.toLowerCase();

    // Check modifier keys
    // Browsers/OS might report different modifier states; use loose comparison
    const requiresCtrl = parts.includes('Ctrl') || parts.includes('Cmd');
    const requiresShift = parts.includes('Shift');
    const requiresAlt = parts.includes('Alt') || parts.includes('Option');

    const isCtrlPressed = !!(e.ctrlKey || e.metaKey);
    const isShiftPressed = !!e.shiftKey;
    const isAltPressed = !!e.altKey;

    return (
      e.key.toLowerCase() === key &&
      isCtrlPressed === requiresCtrl &&
      isShiftPressed === requiresShift &&
      isAltPressed === requiresAlt
    );
  }

  private executeAction(actionId: string): void {
    if (!actionId || typeof actionId !== 'string') return;

    try {
      switch (actionId) {
        case 'ch.duplicateLine':
          this.duplicateLine();
          break;
        case 'ch.deleteLine':
          this.deleteLine();
          break;
        case 'ch.moveLineUp':
          this.moveLineUp();
          break;
        case 'ch.moveLineDown':
          this.moveLineDown();
          break;
        case 'ch.toggleComment':
          this.toggleComment();
          break;
        case 'ch.selectLine':
          this.selectLine();
          break;
        case 'ch.indent':
          this.indentLine();
          break;
        case 'ch.outdent':
          this.outdentLine();
          break;
        case 'ch.joinLines':
          this.joinLines();
          break;
        case 'ch.selectAllOccurrences':
          this.selectAllOccurrences();
          break;
        default:
          console.log('[CodeHelper] Unknown shortcut action:', actionId);
      }
    } catch (err) {
      console.warn('[CodeHelper] Shortcut action threw:', actionId, err);
    }
  }

  private duplicateLine(): void {
    const selection = this.adapter.getSelection();
    const cursor = this.adapter.getCursorPosition();

    // If there's a non-empty selection, duplicate the selected text
    if (
      selection.start.line !== selection.end.line ||
      selection.start.column !== selection.end.column
    ) {
      const selectedText = this.getValueInRange(selection);
      this.adapter.insertText(selectedText);
      return;
    }

    // Otherwise duplicate the current line
    const line = this.adapter.getLine(cursor.line);
    const insertPos = { line: cursor.line + 1, column: 0 };
    this.adapter.replaceRange({ start: insertPos, end: insertPos }, line + '\n');
  }

  private getValueInRange(range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  }): string {
    if (range.start.line === range.end.line) {
      const line = this.adapter.getLine(range.start.line);
      return line.substring(range.start.column, range.end.column);
    }

    let result = '';
    // First line
    const firstLine = this.adapter.getLine(range.start.line);
    result += firstLine.substring(range.start.column) + '\n';

    // Middle lines
    for (let l = range.start.line + 1; l < range.end.line; l++) {
      result += this.adapter.getLine(l) + '\n';
    }

    // Last line
    const lastLine = this.adapter.getLine(range.end.line);
    result += lastLine.substring(0, range.end.column);

    return result;
  }

  private deleteLine(): void {
    const cursor = this.adapter.getCursorPosition();
    const lineCount = this.adapter.getLineCount();

    if (lineCount <= 1) {
      // Delete all content
      this.adapter.replaceRange(
        {
          start: { line: 0, column: 0 },
          end: { line: 0, column: this.adapter.getLine(0).length },
        },
        '',
      );
    } else if (cursor.line === lineCount - 1) {
      // Delete last line
      const prevLine = this.adapter.getLine(cursor.line - 1);
      this.adapter.replaceRange(
        {
          start: { line: cursor.line - 1, column: prevLine.length },
          end: { line: cursor.line, column: 0 },
        },
        '',
      );
    } else {
      // Delete current line + newline
      const line = this.adapter.getLine(cursor.line);
      this.adapter.replaceRange(
        {
          start: { line: cursor.line, column: 0 },
          end: { line: cursor.line + 1, column: 0 },
        },
        '',
      );
    }
  }

  private moveLineUp(): void {
    const cursor = this.adapter.getCursorPosition();
    if (cursor.line === 0) return;

    const currentLine = this.adapter.getLine(cursor.line);
    const prevLine = this.adapter.getLine(cursor.line - 1);

    this.adapter.replaceRange(
      {
        start: { line: cursor.line - 1, column: 0 },
        end: { line: cursor.line, column: currentLine.length },
      },
      currentLine + '\n' + prevLine,
    );

    this.adapter.setCursorPosition({
      line: cursor.line - 1,
      column: cursor.column,
    });
  }

  private moveLineDown(): void {
    const cursor = this.adapter.getCursorPosition();
    const lineCount = this.adapter.getLineCount();
    if (cursor.line >= lineCount - 1) return;

    const currentLine = this.adapter.getLine(cursor.line);
    const nextLine = this.adapter.getLine(cursor.line + 1);

    this.adapter.replaceRange(
      {
        start: { line: cursor.line, column: 0 },
        end: { line: cursor.line + 1, column: nextLine.length },
      },
      nextLine + '\n' + currentLine,
    );

    this.adapter.setCursorPosition({
      line: cursor.line + 1,
      column: cursor.column,
    });
  }

  private toggleComment(): void {
    const selection = this.adapter.getSelection();
    const language = this.adapter.getLanguage();
    const commentStr = getCommentString(language);

    for (let line = selection.start.line; line <= selection.end.line; line++) {
      const text = this.adapter.getLine(line);
      const trimmed = text.trimStart();

      if (trimmed.startsWith(commentStr)) {
        // Uncomment: remove comment prefix (and trailing space if present)
        const indent = text.length - trimmed.length;
        const afterComment = trimmed.substring(commentStr.length);
        const extraSpace = afterComment.startsWith(' ') ? 1 : 0;
        this.adapter.replaceRange(
          {
            start: { line, column: indent },
            end: { line, column: indent + commentStr.length + extraSpace },
          },
          '',
        );
      } else {
        // Comment: add comment prefix after indentation
        const indent = text.length - trimmed.length;
        this.adapter.replaceRange(
          {
            start: { line, column: indent },
            end: { line, column: indent },
          },
          commentStr + ' ',
        );
      }
    }
  }

  private selectLine(): void {
    const cursor = this.adapter.getCursorPosition();
    const line = this.adapter.getLine(cursor.line);

    this.adapter.setSelection(
      { line: cursor.line, column: 0 },
      { line: cursor.line, column: line.length },
    );
  }

  private indentLine(): void {
    const cursor = this.adapter.getCursorPosition();
    this.adapter.indentLine(cursor.line, 'increase');
  }

  private outdentLine(): void {
    const cursor = this.adapter.getCursorPosition();
    this.adapter.indentLine(cursor.line, 'decrease');
  }

  private joinLines(): void {
    const cursor = this.adapter.getCursorPosition();
    const lineCount = this.adapter.getLineCount();
    if (cursor.line >= lineCount - 1) return;

    const currentLine = this.adapter.getLine(cursor.line);
    const nextLine = this.adapter.getLine(cursor.line + 1);

    this.adapter.replaceRange(
      {
        start: { line: cursor.line, column: currentLine.length },
        end: { line: cursor.line + 1, column: nextLine.length },
      },
      ' ',
    );
  }

  private selectAllOccurrences(): void {
    // Select the word at cursor if nothing selected
    const selection = this.adapter.getSelection();
    if (
      selection.start.line === selection.end.line &&
      selection.start.column === selection.end.column
    ) {
      // Select current word
      const cursor = this.adapter.getCursorPosition();
      const line = this.adapter.getLine(cursor.line);
      // Simple word boundary detection
      let start = cursor.column;
      let end = cursor.column;
      while (start > 0 && /\w/.test(line[start - 1])) start--;
      while (end < line.length && /\w/.test(line[end])) end++;
      if (start < end) {
        this.adapter.setSelection(
          { line: cursor.line, column: start },
          { line: cursor.line, column: end },
        );
      }
    }
    // For full multi-cursor selection, this would require Monaco API access
    // beyond the adapter abstraction. This provides single-selection of the word.
  }

  updateSettings(settings: ShortcutSettings): void {
    this.settings = settings;
  }

  dispose(): void {
    this.disposables.forEach((d) => {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    });
    this.disposables = [];
  }
}
