import type { EditorAdapter } from '../adapters/types';

const LANGUAGE_MAP: Record<string, string> = {
  cpp: 'cpp',
  'c++': 'cpp',
  'c++14': 'cpp',
  'c++17': 'cpp',
  'c++20': 'cpp',
  c: 'c',
  java: 'java',
  java8: 'java',
  python: 'python',
  python3: 'python',
  python3x: 'python',
  javascript: 'javascript',
  js: 'javascript',
  'node.js': 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  scala: 'scala',
  'c#': 'csharp',
  csharp: 'csharp',
};

export function detectLanguage(adapter: EditorAdapter): string {
  // 1. Ask the editor directly
  const lang = adapter.getLanguage();
  if (lang && lang !== 'unknown') {
    return normalizeLanguage(lang);
  }

  // 2. Fall back to URL detection
  const url = window.location.href;
  if (url.includes('/problems/')) {
    // Check language selector on the page
    const select = document.querySelector('[data-language-selector], .language-selector');
    if (select) {
      const text = select.textContent || '';
      if (text) return normalizeLanguage(text);
    }
  }

  return 'unknown';
}

function normalizeLanguage(lang: string): string {
  if (!lang) return 'unknown';
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_MAP[normalized] || normalized;
}

export function getCommentString(language: string): string {
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
    ruby: '#',
    php: '//',
    swift: '//',
    kotlin: '//',
    scala: '//',
    csharp: '//',
  };
  return map[language] ?? '//';
}
