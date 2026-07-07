import { THEMES } from './definitions';
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

function applyEditorTheme(adapter: EditorAdapter, theme: ReturnType<typeof THEMES>[string]): void {
  if (adapter.editorType === 'monaco') {
    applyMonacoTheme(adapter, theme);
  }
}

function applyMonacoTheme(
  adapter: EditorAdapter,
  theme: ReturnType<typeof THEMES>[string],
): void {
  // Monaco theme application is handled via its API
  // This is called from the content script's MAIN world
  const monaco = (window as any).monaco;
  if (!monaco?.editor) return;

  monaco.editor.defineTheme('ch-custom', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: theme.colors.comment.replace('#', '') },
      { token: 'keyword', foreground: theme.colors.keyword.replace('#', '') },
      { token: 'string', foreground: theme.colors.string.replace('#', '') },
      { token: 'number', foreground: theme.colors.number.replace('#', '') },
      { token: 'type.identifier', foreground: theme.colors.type.replace('#', '') },
      { token: 'identifier', foreground: theme.colors.variable.replace('#', '') },
    ],
    colors: {
      'editor.background': theme.colors.bg,
      'editor.foreground': theme.colors.fg,
      'editor.selectionBackground': theme.colors.selection,
      'editor.lineHighlightBackground': theme.colors.lineHighlight,
      'editorCursor.foreground': theme.colors.cursor,
      'editorLineNumber.foreground': theme.colors.lineNumber,
      'editorLineNumber.activeForeground': theme.colors.lineNumberActive,
      'editorIndentGuide.background': theme.colors.indentGuide,
    },
  });

  monaco.editor.setTheme('ch-custom');
}

export function removeTheme(): void {
  removeStyle(STYLE_ID);
}
