export interface Snippet {
  prefix: string[];
  body: string;
  description: string;
  language: string[];
}

export interface ActiveSnippet {
  tabstops: Tabstop[];
  currentIndex: number;
}

export interface Tabstop {
  line: number;
  column: number;
  length: number;
  placeholder?: string;
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
