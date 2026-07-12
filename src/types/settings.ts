import type { Snippet } from './snippet';
import type { ShortcutDefinition } from './shortcuts';

export interface ThemeSettings {
  name:
    | 'vscode-dark'
    | 'github-dark'
    | 'monokai'
    | 'one-dark'
    | 'dracula'
    | 'solarized-dark'
    | 'nord'
    | 'tokyo-night'
    | 'catppuccin-mocha'
    | 'ayu-dark'
    | 'gruvbox-dark'
    | 'material-palenight'
    | 'synthwave-84'
    | 'everforest-dark'
    | 'rose-pine-moon'
    | 'night-owl';
  customColors?: Record<string, string>;
}

export interface FontSettings {
  family: string;
  size: number;
  lineHeight: number;
  letterSpacing: number;
  ligatures: boolean;
}

export interface SnippetPack {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  languages: string[];
  url: string;
  installed: boolean;
  enabled: boolean;
  /** Remote version from the latest index (populated after fetchIndex). */
  remoteVersion?: string;
  /** ISO timestamp of when this pack was last updated locally. */
  installedAt?: string;
  /** ISO timestamp from the remote index's lastUpdated field. */
  lastUpdated?: string;
  /** Snippet count at install time (for diff stats). */
  snippetCount?: number;
}

export interface SnippetSettings {
  enabled: boolean;
  customSnippets: Snippet[];
  installedPacks?: SnippetPack[];
}

export interface AutoCloseSettings {
  enabled: boolean;
  pairs: Record<string, string>;
}

export interface IndentationSettings {
  enabled: boolean;
}

export interface LineHighlightSettings {
  enabled: boolean;
  color: string;
  opacity: number;
}

export interface BracketPairSettings {
  enabled: boolean;
}

export interface IndentGuideSettings {
  enabled: boolean;
  color: string;
}

export interface CursorSettings {
  enabled: boolean;
  width: number;
  color: string;
  blinkStyle: 'smooth' | 'phase' | 'expand' | 'solid';
}

export interface SelectionSettings {
  enabled: boolean;
  backgroundColor: string;
  foregroundColor: string;
}

export interface ShortcutSettings {
  enabled: boolean;
  mappings: Record<string, ShortcutDefinition>;
}

export interface Features {
  snippets: SnippetSettings;
  autoClose: AutoCloseSettings;
  indentation: IndentationSettings;
  lineHighlight: LineHighlightSettings;
  bracketPairs: BracketPairSettings;
  indentGuides: IndentGuideSettings;
  cursor: CursorSettings;
  selection: SelectionSettings;
  shortcuts: ShortcutSettings;
}

export interface Settings {
  enabled: boolean;
  perSite: Record<string, boolean>;
  theme: ThemeSettings;
  font: FontSettings;
  features: Features;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  perSite: {
    leetcode: true,
    codechef: true,
    codeforces: true,
    hackerrank: true,
    atcoder: true,
    geeksforgeeks: true,
    hackerearth: true,
  },
  theme: {
    name: 'vscode-dark',
  },
  font: {
    family: 'JetBrains Mono',
    size: 14,
    lineHeight: 1.5,
    letterSpacing: 0,
    ligatures: true,
  },
  features: {
    snippets: {
      enabled: true,
      customSnippets: [],
      installedPacks: [],
    },
    autoClose: {
      enabled: true,
      pairs: {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'",
        '`': '`',
      },
    },
    indentation: {
      enabled: true,
    },
    lineHighlight: {
      enabled: true,
      color: '#2a2d2e',
      opacity: 0.5,
    },
    bracketPairs: {
      enabled: true,
    },
    indentGuides: {
      enabled: true,
      color: '#404040',
    },
    cursor: {
      enabled: true,
      width: 2,
      color: '#aeafad',
      blinkStyle: 'smooth',
    },
    selection: {
      enabled: true,
      backgroundColor: '#264f78',
      foregroundColor: '#ffffff',
    },
    shortcuts: {
      enabled: true,
      mappings: {},
    },
  },
};
