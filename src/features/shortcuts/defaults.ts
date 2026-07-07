import type { ShortcutDefinition } from '../../types/shortcuts';

export const DEFAULT_SHORTCUTS: Record<string, ShortcutDefinition> = {
  duplicateLine: {
    keys: { win: 'Shift+Alt+Down', mac: 'Shift+Option+Down' },
    description: 'Duplicate line down',
    action: 'ch.duplicateLine',
  },
  deleteLine: {
    keys: { win: 'Ctrl+Shift+K', mac: 'Cmd+Shift+K' },
    description: 'Delete line',
    action: 'ch.deleteLine',
  },
  moveLineUp: {
    keys: { win: 'Alt+Up', mac: 'Option+Up' },
    description: 'Move line up',
    action: 'ch.moveLineUp',
  },
  moveLineDown: {
    keys: { win: 'Alt+Down', mac: 'Option+Down' },
    description: 'Move line down',
    action: 'ch.moveLineDown',
  },
  toggleComment: {
    keys: { win: 'Ctrl+Shift+/', mac: 'Cmd+Shift+/' },
    description: 'Toggle line comment',
    action: 'ch.toggleComment',
  },
  selectLine: {
    keys: { win: 'Ctrl+L', mac: 'Cmd+L' },
    description: 'Select line',
    action: 'ch.selectLine',
  },
  formatDocument: {
    keys: { win: 'Shift+Alt+F', mac: 'Shift+Option+F' },
    description: 'Format document',
    action: 'ch.formatDocument',
  },
};

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
