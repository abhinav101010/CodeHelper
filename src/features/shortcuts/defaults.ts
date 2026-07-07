import type { ShortcutDefinition } from '../../types/shortcuts';

export const DEFAULT_SHORTCUTS: Record<string, ShortcutDefinition> = {
  duplicateLine: {
    keys: { win: 'Shift+Alt+Down', mac: 'Shift+Option+Down' },
    description: 'Duplicate line down',
    action: 'ch.duplicateLine',
  },
  duplicateLineCtrlD: {
    keys: { win: 'Ctrl+D', mac: 'Cmd+D' },
    description: 'Duplicate selection or line',
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
  // Additional useful shortcuts
  indent: {
    keys: { win: 'Tab', mac: 'Tab' },
    description: 'Indent line',
    action: 'ch.indent',
  },
  outdent: {
    keys: { win: 'Shift+Tab', mac: 'Shift+Tab' },
    description: 'Outdent line',
    action: 'ch.outdent',
  },
  joinLines: {
    keys: { win: 'Ctrl+Shift+J', mac: 'Cmd+Shift+J' },
    description: 'Join lines',
    action: 'ch.joinLines',
  },
  selectAllOccurrences: {
    keys: { win: 'Ctrl+Shift+L', mac: 'Cmd+Shift+L' },
    description: 'Select all occurrences of selection',
    action: 'ch.selectAllOccurrences',
  },
};
