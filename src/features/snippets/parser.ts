/**
 * VS Code Snippet Parser
 *
 * Implements the official VS Code snippet grammar as a tokenizer + recursive-descent
 * parser. Handles all standard forms:
 *
 *   Placeholders:  $1  ${1}  ${1:default}  ${1|a,b,c|}
 *   Variables:     $NAME  ${NAME}  ${NAME:default}
 *   Nested:        ${1:hello ${2:world}}
 *   Mirrors:       $1 appearing multiple times
 *   Escapes:       \\  \$  \}  \, (within choices)
 *
 * Unknown variables become editable placeholders ($0), matching VS Code behavior.
 *
 * Grammar (simplified):
 *   snippet   → segment*
 *   segment   → text | placeholder | choice | variable
 *   text      → char (any non-special char, or escaped char)
 *   placeholder → '$' int | '${' int '}' | '${' int ':' snippet '}'
 *   choice    → '${' int '|' choices '|}'
 *   choices   → text (',' text)*
 *   variable  → '$' name | '${' name '}' | '${' name ':' snippet '}'
 *   name      → [_a-zA-Z][_a-zA-Z0-9]*
 *   int       → [0-9]+
 */

import type { Segment, ParsedSnippet } from '../../types/snippet';

// ── Token types ────────────────────────────────────────────────────────────

const enum TokenKind {
  TEXT = 0,
  DOLLAR = 1,
  LBRACE = 2,
  RBRACE = 3,
  PIPE = 4,
  COLON = 5,
  COMMA = 6,
  BACKSLASH = 7,
  NUMBER = 8,
  NAME = 9,
  EOF = 10,
}

interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

// ── Tokenizer ──────────────────────────────────────────────────────────────

class Tokenizer {
  private input: string;
  private pos: number;
  private tokens: Token[] = [];
  private tokenIndex = 0;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  /** Tokenize the entire input. Call once, then use read() etc. */
  tokenize(): Token[] {
    this.tokens = [];
    this.tokenIndex = 0;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      const start = this.pos;

      if (ch === '\\') {
        this.pos++;
        if (this.pos < this.input.length) {
          // Emit a single TEXT token with the escaped character
          this.tokens.push({
            kind: TokenKind.TEXT,
            value: this.input[this.pos],
            pos: start,
          });
          this.pos++;
        } else {
          // Trailing backslash — treat as literal
          this.tokens.push({ kind: TokenKind.TEXT, value: '\\', pos: start });
        }
        continue;
      }

      if (ch === '$') {
        this.tokens.push({ kind: TokenKind.DOLLAR, value: '$', pos: start });
        this.pos++;
        continue;
      }
      if (ch === '{') {
        this.tokens.push({ kind: TokenKind.LBRACE, value: '{', pos: start });
        this.pos++;
        continue;
      }
      if (ch === '}') {
        this.tokens.push({ kind: TokenKind.RBRACE, value: '}', pos: start });
        this.pos++;
        continue;
      }
      if (ch === '|') {
        this.tokens.push({ kind: TokenKind.PIPE, value: '|', pos: start });
        this.pos++;
        continue;
      }
      if (ch === ':') {
        this.tokens.push({ kind: TokenKind.COLON, value: ':', pos: start });
        this.pos++;
        continue;
      }
      if (ch === ',') {
        this.tokens.push({ kind: TokenKind.COMMA, value: ',', pos: start });
        this.pos++;
        continue;
      }

      // Digit sequence
      if (/[0-9]/.test(ch)) {
        let num = '';
        while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
          num += this.input[this.pos];
          this.pos++;
        }
        this.tokens.push({ kind: TokenKind.NUMBER, value: num, pos: start });
        continue;
      }

      // Name (variable name — starts with letter or underscore)
      if (/[a-zA-Z_]/.test(ch)) {
        let name = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
          name += this.input[this.pos];
          this.pos++;
        }
        this.tokens.push({ kind: TokenKind.NAME, value: name, pos: start });
        continue;
      }

      // Any other character is regular text
      this.tokens.push({ kind: TokenKind.TEXT, value: ch, pos: start });
      this.pos++;
    }

    this.tokens.push({ kind: TokenKind.EOF, value: '', pos: this.pos });
    this.tokenIndex = 0;
    return this.tokens;
  }

  peek(): Token {
    return this.tokens[this.tokenIndex] ?? this.tokens[this.tokens.length - 1];
  }

  read(): Token {
    const t = this.tokens[this.tokenIndex] ?? this.tokens[this.tokens.length - 1];
    if (this.tokenIndex < this.tokens.length - 1) this.tokenIndex++;
    return t;
  }

  expect(kind: TokenKind): Token {
    const t = this.read();
    if (t.kind !== kind) {
      throw new Error(
        `Expected token ${kind} but got ${t.kind} ("${t.value}") at position ${t.pos}`,
      );
    }
    return t;
  }
}

// ── Parser ─────────────────────────────────────────────────────────────────

class Parser {
  private tokenizer: Tokenizer;
  private tokens: Token[] = [];
  private pos = 0;

  constructor(input: string) {
    this.tokenizer = new Tokenizer(input);
  }

  /** Parse the entire input into segments. */
  parse(): ParsedSnippet {
    this.tokens = this.tokenizer.tokenize();
    this.pos = 0;
    // Top level: do NOT stop at RBRACE — literal } characters in code
    // (e.g., PHP closing braces) would be silently dropped.
    const segments = this.parseSnippet(false);
    return { segments };
  }

  // ── Entry point ────────────────────────────────────────────────────────

  /**
   * Parse segments until EOF or (optionally) RBRACE/PIPE.
   *
   * @param stopAtRbrace - When true, stops at RBRACE (used inside ${…}).
   *                       When false (top level), RBRACE is treated as literal text
   *                       so closing braces in code (PHP, JS, etc.) are preserved.
   */
  private parseSnippet(stopAtRbrace = false): Segment[] {
    const segments: Segment[] = [];
    while (!this.isEOF()) {
      const t = this.peek();
      // Only stop at RBRACE/PIPE when parsing inside a ${...} construct.
      // At the top level, these are literal code characters.
      if (stopAtRbrace && (t.kind === TokenKind.RBRACE || t.kind === TokenKind.PIPE)) break;
      const segs = this.parseSegment();
      for (const seg of segs) {
        segments.push(seg);
      }
    }
    return segments;
  }

  /** segment → placeholder | choice | variable | text */
  private parseSegment(): Segment[] {
    const t = this.peek();

    // placeholder/variable: $1, ${1}, $name, $$, etc.
    if (t.kind === TokenKind.DOLLAR) {
      return this.parseDollarConstruct();
    }

    // text (including escaped chars already handled by tokenizer)
    if (t.kind === TokenKind.TEXT) {
      this.pos++;
      return [{ type: 'text', value: t.value }];
    }

    // Name (standalone — shouldn't happen normally, but handle gracefully)
    if (t.kind === TokenKind.NAME) {
      this.pos++;
      return [{ type: 'text', value: t.value }];
    }

    // Number (standalone — shouldn't happen)
    if (t.kind === TokenKind.NUMBER) {
      this.pos++;
      return [{ type: 'text', value: t.value }];
    }

    // Unexpected tokens like }, |, :, , — treat as text
    this.pos++;
    return [{ type: 'text', value: t.value }];
  }

  /** Parse anything starting with $ — returns Segment[] to handle $$ sequences */
  private parseDollarConstruct(): Segment[] {
    // Consume $
    const dollar = this.read();
    if (dollar.kind !== TokenKind.DOLLAR) {
      return [{ type: 'text', value: '$' }];
    }

    // Case 1: $$ → literal $
    if (this.peek().kind === TokenKind.DOLLAR) {
      this.pos++; // consume second $
      // Check for $${...}: literal $ + brace construct
      if (this.peek().kind === TokenKind.LBRACE) {
        return [{ type: 'text', value: '$' }, this.parseBraceConstruct()];
      }
      // Check for $$number: literal $ + simple tabstop
      if (this.peek().kind === TokenKind.NUMBER) {
        const numToken = this.read();
        const index = parseInt(numToken.value, 10);
        return [{ type: 'text', value: '$' }, { type: 'tabstop', index }];
      }
      return [{ type: 'text', value: '$' }];
    }

    // Case 2: ${...} — brace-delimited construct
    if (this.peek().kind === TokenKind.LBRACE) {
      return [this.parseBraceConstruct()];
    }

    // Case 3: $number — simple tabstop
    if (this.peek().kind === TokenKind.NUMBER) {
      const numToken = this.read();
      const index = parseInt(numToken.value, 10);
      return [{ type: 'tabstop', index }];
    }

    // Case 4: $name — simple variable
    if (this.peek().kind === TokenKind.NAME) {
      const nameToken = this.read();
      return [{ type: 'variable', name: nameToken.value }];
    }

    // Case 5: $ followed by something else — literal $
    return [{ type: 'text', value: '$' }];
  }

  /** Parse ${...} — placeholder, choice, or variable */
  private parseBraceConstruct(): Segment {
    // Consume {
    this.read(); // LBRACE

    // Peek at content
    const content = this.peek();

    // ${| ... }| is not valid, but VS Code would handle it
    // We'll try to parse based on the first token after {

    // ${number ...} — tabstop or choice
    if (content.kind === TokenKind.NUMBER) {
      const numToken = this.read();
      const index = parseInt(numToken.value, 10);

      // What follows?
      if (this.peek().kind === TokenKind.COLON) {
        // ${number: ...} — placeholder with default
        this.pos++; // consume :
        const children = this.parseSnippet(true); // stopAtRbrace = true
        // Expect }
        this.expectRbrace();
        return { type: 'tabstop', index, children };
      }

      if (this.peek().kind === TokenKind.PIPE) {
        // ${number|...|} — choice
        this.pos++; // consume |
        const choices = this.parseChoices();
        // Expect |
        if (this.peek().kind === TokenKind.PIPE) {
          this.pos++; // consume |
        }
        // Expect }
        this.expectRbrace();
        return { type: 'choice', index, choices };
      }

      // ${number} — simple placeholder
      if (this.peek().kind === TokenKind.RBRACE) {
        this.pos++; // consume }
        return { type: 'tabstop', index };
      }

      // ${number followed by something unexpected
      // Try to consume until }
      const rest = this.consumeUntilRbrace();
      if (rest) {
        return { type: 'tabstop', index, children: rest };
      }
      return { type: 'tabstop', index };
    }

    // ${name ...} — variable
    if (content.kind === TokenKind.NAME) {
      const nameToken = this.read();
      const name = nameToken.value;

      if (this.peek().kind === TokenKind.COLON) {
        // ${name:default}
        this.pos++; // consume :
        const children = this.parseSnippet(true); // stopAtRbrace = true
        this.expectRbrace();
        return { type: 'variable', name, children };
      }

      // ${name}
      this.expectRbrace();
      return { type: 'variable', name };
    }

    // ${ :something } or ${} — empty braces, treat as literal ${}
    this.consumeUntilRbrace();
    return { type: 'text', value: '${}' };
  }

  /** Parse comma-separated choices inside ${num|...|} */
  private parseChoices(): string[] {
    const choices: string[] = [];
    let current = '';

    while (!this.isEOF()) {
      const t = this.peek();

      if (t.kind === TokenKind.PIPE) {
        // End of choices
        if (current.length > 0 || choices.length > 0) {
          choices.push(current);
        } else {
          // Empty choice list — push empty string as the single choice
          choices.push('');
        }
        return choices;
      }

      if (t.kind === TokenKind.COMMA) {
        choices.push(current);
        current = '';
        this.pos++;
        continue;
      }

      if (t.kind === TokenKind.TEXT) {
        current += t.value;
        this.pos++;
        continue;
      }

      if (t.kind === TokenKind.DOLLAR) {
        // In choice context, $ is literal. But handle $$ → $ for consistency
        this.pos++;
        if (this.peek().kind === TokenKind.DOLLAR) {
          current += '$';
          this.pos++;
        } else {
          current += '$';
        }
        continue;
      }

      // Skip any other token inside choices (NAME, NUMBER, etc.) as literal
      current += t.value;
      this.pos++;
    }

    if (current.length > 0) choices.push(current);
    return choices;
  }

  /** Consume tokens until we hit RBRACE or EOF. Returns parsed segments if any meaningful content found. */
  private consumeUntilRbrace(): Segment[] | null {
    const segments: Segment[] = [];
    while (!this.isEOF() && this.peek().kind !== TokenKind.RBRACE) {
      const segs = this.parseSegment();
      for (const seg of segs) {
        segments.push(seg);
      }
    }
    if (this.peek().kind === TokenKind.RBRACE) {
      this.pos++; // consume }
    }
    return segments.length > 0 ? segments : null;
  }

  private expectRbrace(): void {
    if (this.peek().kind === TokenKind.RBRACE) {
      this.pos++;
    }
    // If missing, just continue — VS Code is lenient about missing closing braces
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
  }

  private read(): Token {
    const t = this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }

  private isEOF(): boolean {
    return this.tokens[this.pos]?.kind === TokenKind.EOF || this.pos >= this.tokens.length - 1;
  }
}

// ── Convenience wrapper ───────────────────────────────────────────────────

/**
 * Parse a snippet body string into segments.
 *
 * @param body - The raw snippet body string (may contain $, ${}, etc.)
 * @returns ParsedSnippet with segments array
 */
export function parseSnippet(body: string): ParsedSnippet {
  try {
    const parser = new Parser(body);
    return parser.parse();
  } catch (err) {
    console.warn('[CodeHelper] Snippet parse error:', err);
    // Fallback: return entire body as a single text segment
    return { segments: [{ type: 'text', value: body }] };
  }
}

/**
 * Get the plain text of a parsed snippet (without placeholders/variables resolved).
 * Used for preview display.
 */
export function snippetPreview(parsed: ParsedSnippet): string {
  return flattenSegments(parsed.segments);
}

function flattenSegments(segments: Segment[]): string {
  let result = '';
  for (const seg of segments) {
    switch (seg.type) {
      case 'text':
        result += seg.value;
        break;
      case 'tabstop':
        if (seg.children && seg.children.length > 0) {
          result += flattenSegments(seg.children);
        } else {
          result += '';
        }
        break;
      case 'choice':
        result += seg.choices[0] ?? '';
        break;
      case 'variable':
        if (seg.children && seg.children.length > 0) {
          result += flattenSegments(seg.children);
        } else {
          result += `\${${seg.name}}`;
        }
        break;
    }
  }
  return result;
}
