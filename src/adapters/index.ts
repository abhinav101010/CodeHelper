import type { EditorAdapter } from './types';
import { createMonacoAdapter } from './monaco';
import { createAceAdapter } from './ace';
import { createCodeMirrorAdapter } from './codemirror';

export type { EditorAdapter, Disposable, CompositeDisposable } from './types';

export function detectEditor(container: HTMLElement): EditorAdapter | null {
  // Try Monaco first (LeetCode)
  if (
    container.matches('.monaco-editor') ||
    container.querySelector('.monaco-editor') ||
    (window as any).monaco
  ) {
    const adapter = createMonacoAdapter(container);
    if (adapter) return adapter;
  }

  // Try Ace (CodeChef, HackerRank)
  if (
    container.matches('.ace_editor') ||
    container.querySelector('.ace_editor') ||
    (container as any).env?.editor
  ) {
    const adapter = createAceAdapter(container);
    if (adapter) return adapter;
  }

  // Try CodeMirror (Codeforces, AtCoder)
  const cmAdapter = createCodeMirrorAdapter(container);
  if (cmAdapter) return cmAdapter;

  return null;
}
