import { injectStyle, removeStyle } from '../../core/injector';
import type { FontSettings } from '../../types/settings';
import type { EditorAdapter } from '../../adapters/types';

const STYLE_ID = 'ch-fonts';

const FONT_URLS: Record<string, string> = {
  'JetBrains Mono': 'fonts/JetBrainsMono-Regular.woff2',
  'Fira Code': 'fonts/FiraCode-Regular.woff2',
  'Cascadia Code': 'fonts/CascadiaCode-Regular.woff2',
  'Source Code Pro': 'fonts/SourceCodePro-Regular.woff2',
};

export function applyFont(font: FontSettings, adapter?: EditorAdapter | null): void {
  // For Monaco: use its API so cursor position calculations stay correct
  if (adapter?.editorType === 'monaco') {
    adapter.updateOptions({
      fontFamily: `"${font.family}", monospace`,
      fontSize: font.size,
      fontLigatures: font.ligatures,
    });
    // Don't inject CSS for Monaco — it would break cursor positioning
    return;
  }

  // For Ace / CodeMirror: CSS injection is fine
  const fontFamily = `"${font.family}", monospace`;
  const ligatures = font.ligatures ? 'normal' : 'none';

  const css = `
    .ace_editor,
    .ace_text-layer,
    .CodeMirror,
    .cm-editor,
    .cm-content {
      font-family: ${fontFamily} !important;
      font-size: ${font.size}px !important;
      line-height: ${font.lineHeight} !important;
      letter-spacing: ${font.letterSpacing}px !important;
      font-variant-ligatures: ${ligatures} !important;
    }
  `;

  injectStyle(STYLE_ID, css);
}

export function removeFont(): void {
  removeStyle(STYLE_ID);
}

export function getFontUrl(fontName: string): string | null {
  const path = FONT_URLS[fontName];
  if (!path) return null;
  return chrome.runtime.getURL(path);
}
