export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export type EditorType = 'monaco' | 'ace' | 'codemirror5' | 'codemirror6';

export interface EditorInfo {
  type: EditorType;
  language: string;
  container: HTMLElement;
}
