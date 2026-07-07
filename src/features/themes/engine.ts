import { THEMES } from './definitions';
import type { ThemeDefinition } from './definitions';
import { injectStyle, removeStyle } from '../../core/injector';
import type { EditorAdapter } from '../../adapters/types';

const STYLE_ID = 'ch-theme-vars';

export function applyTheme(themeName: string, adapter?: EditorAdapter | null): void {
  const theme = THEMES[themeName];
  if (!theme) return;

  const vars = Object.entries(theme.colors)
    .map(([key, value]) => `  --ch-${key}: ${value};`)
    .join('\n');

  injectStyle(
    STYLE_ID,
    `
    :root {
${vars}
    }
  `,
  );

  // Apply editor-specific theme
  if (adapter) {
    applyEditorTheme(adapter, theme);
  }
}

function stripHash(color: string | undefined): string {
  if (!color || typeof color !== 'string') return '000000';
  return color.replace('#', '');
}

function applyMonacoTheme(_adapter: EditorAdapter, theme: ThemeDefinition): void {
  const monaco = (window as any).monaco;
  if (!monaco?.editor) return;

  const c = theme.colors;

  monaco.editor.defineTheme('ch-custom', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: stripHash(c.comment) },
      { token: 'keyword', foreground: stripHash(c.keyword) },
      { token: 'string', foreground: stripHash(c.string) },
      { token: 'number', foreground: stripHash(c.number) },
      { token: 'type.identifier', foreground: stripHash(c.type) },
      { token: 'identifier', foreground: stripHash(c.variable) },
    ],
    colors: {
      'editor.background': c.bg ?? '#1e1e1e',
      'editor.foreground': c.fg ?? '#d4d4d4',
      'editor.selectionBackground': c.selection ?? '#264f78',
      'editor.lineHighlightBackground': c.lineHighlight ?? '#2a2d2e',
      'editorCursor.foreground': c.cursor ?? '#aeafad',
      'editorLineNumber.foreground': c.lineNumber ?? '#858585',
      'editorLineNumber.activeForeground': c.lineNumberActive ?? '#c6c6c6',
      'editorIndentGuide.background': c.indentGuide ?? '#404040',
      // Rainbow Brackets colorization (bracket pair highlights)
      'editorBracketHighlight.foreground1': stripHash(c.bracketPair1),
      'editorBracketHighlight.foreground2': stripHash(c.bracketPair2),
      'editorBracketHighlight.foreground3': stripHash(c.bracketPair3),
      'editorBracketHighlight.foreground4': stripHash(c.bracketPair4),
      'editorBracketHighlight.foreground5': stripHash(c.bracketPair5),
      'editorBracketHighlight.foreground6': stripHash(c.bracketPair6),
      'editorBracketHighlight.unexpectedBracket.foreground': stripHash(c.matchingBracket),
    },
  });

  monaco.editor.setTheme('ch-custom');
}

function applyEditorTheme(adapter: EditorAdapter, theme: ThemeDefinition): void {
  if (adapter.editorType === 'monaco') {
    applyMonacoTheme(adapter, theme);
  }
}

export function removeTheme(): void {
  removeStyle(STYLE_ID);
}
