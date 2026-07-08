export interface Snippet {
  prefix: string[];
  body: string;
  description: string;
  language: string[];
}

export interface SnippetTrigger {
  snippet: Snippet;
  triggerLength: number;
}

export interface ParsedSnippet {
  segments: Segment[];
}

export type Segment =
  | { type: 'text'; value: string }
  | { type: 'tabstop'; index: number; children?: Segment[] }
  | { type: 'variable'; value: string };

/**
 * Represents a resolved tabstop with absolute position.
 * Used by SnippetSession for navigation and decorations.
 */
export interface TabstopInfo {
  /** Tabstop index (0 = final cursor position, >0 = navigable placeholder). */
  index: number;
  /** 0-based line number (absolute in the document). */
  line: number;
  /** 0-based column number (absolute in the document). */
  column: number;
  /** Length of the placeholder text. */
  length: number;
  /** Default placeholder text. */
  placeholder: string;
  /** Number of additional lines the placeholder spans (0 = single line). */
  lineCount: number;
}

/** @deprecated Use TabstopInfo instead. Kept for backward compat. */
export interface ActiveSnippet {
  tabstops: TabstopInfo[];
  currentIndex: number;
}

/** @deprecated Use TabstopInfo instead. */
export interface Tabstop {
  line: number;
  column: number;
  length: number;
  placeholder?: string;
}
