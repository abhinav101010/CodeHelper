import { injectStyle, removeStyle } from '../../core/injector';
import type { FontSettings } from '../../types/settings';

const STYLE_ID = 'ch-fonts';

const FONT_URLS: Record<string, string> = {
  'JetBrains Mono': 'fonts/JetBrainsMono-Regular.woff2',
  'Fira Code': 'fonts/FiraCode-Regular.woff2',
  'Cascadia Code': 'fonts/CascadiaCode-Regular.woff2',
  'Source Code Pro': 'fonts/SourceCodePro-Regular.woff2',
};

export function applyFont(font: FontSettings): void {
  const fontFamily = `"${font.family}", monospace`;
  const ligatures = font.ligatures ? 'normal' : 'none';

  const css = `
    .monaco-editor .inputarea,
    .monaco-editor .view-lines,
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
