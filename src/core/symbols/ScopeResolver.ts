/**
 * ScopeResolver — Tracks scope hierarchy for a document.
 *
 * Maintains a stack of active scopes as lines are processed.
 * Uses indentation for Python and brace depth for C-like languages.
 * Enables scope-aware ranking and symbol filtering.
 */

import type { Scope } from './DocumentSymbol';

export class ScopeResolver {
  /** Stack of active scopes. */
  private stack: Scope[] = [];
  /** Current brace depth (for C-like languages). */
  private braceDepth = 0;
  /** Indentation-based scope tracking (for Python). */
  private indentStack: Array<{ indent: number; scope: Scope }> = [];

  /** Whether the current language uses braces for scoping. */
  private useBraces = true;

  reset(language: string): void {
    this.stack = [];
    this.braceDepth = 0;
    this.indentStack = [];
    this.useBraces = !language.startsWith('python');
    // Push global scope
    this.stack.push({ name: 'global', kind: 'global', startLine: 0, endLine: -1 });
  }

  /** Process a line to update scope state. Returns the current scope name. */
  processLine(line: string, lineIdx: number): string {
    if (this.useBraces) {
      // Track braces
      for (const ch of line) {
        if (ch === '{') this.braceDepth++;
        if (ch === '}') {
          this.braceDepth = Math.max(0, this.braceDepth - 1);
          // Pop scopes at matching close
          while (
            this.stack.length > 1 &&
            this.stack[this.stack.length - 1].kind !== 'global'
          ) {
            const popped = this.stack.pop()!;
            popped.endLine = lineIdx;
          }
        }
      }

      // Opening brace on this line → push scope
      if (line.includes('{')) {
        // Don't push here — let the caller push explicit scopes
        // via pushScope(). We just track depth for reference.
      }
    } else {
      // Python-style indentation tracking
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      while (
        this.indentStack.length > 0 &&
        indent <= this.indentStack[this.indentStack.length - 1].indent
      ) {
        const popped = this.indentStack.pop()!;
        popped.scope.endLine = lineIdx - 1;
        if (this.stack[this.stack.length - 1] === popped.scope) {
          this.stack.pop();
        }
      }
    }

    return this.getCurrentScopeName();
  }

  /** Push a named scope (e.g. function, class, loop). */
  pushScope(name: string, kind: Scope['kind'], startLine: number, indent = 0): void {
    const scope: Scope = { name, kind, startLine, endLine: -1 };
    this.stack.push(scope);
    if (!this.useBraces) {
      this.indentStack.push({ indent, scope });
    }
  }

  /** Pop the innermost non-global scope. */
  popScope(): void {
    while (this.stack.length > 1) {
      const popped = this.stack.pop()!;
      if (popped.kind !== 'global') {
        popped.endLine = popped.endLine === -1 ? this.lastLine : popped.endLine;
        return;
      }
    }
  }

  private lastLine = 0;

  /** Set the last processed line number (for closing open scopes). */
  setLastLine(line: number): void {
    this.lastLine = line;
  }

  /** Get the current innermost scope name. */
  getCurrentScopeName(): string {
    return this.stack[this.stack.length - 1]?.name ?? 'global';
  }

  /** Get the full scope stack. */
  getStack(): Scope[] {
    return [...this.stack];
  }

  /** Get current brace depth. */
  getBraceDepth(): number {
    return this.braceDepth;
  }

  /** Check if a given line is within a specific scope. */
  isInScope(scopeName: string, line: number): boolean {
    for (const scope of this.stack) {
      if (scope.name === scopeName) {
        if (scope.endLine === -1 || line <= scope.endLine) return true;
      }
    }
    return false;
  }

  /**
   * Compute how close a symbol's declaration line is to a cursor line.
   * Returns a score 0-5.
   */
  proximityScore(symbolLine: number, cursorLine: number): number {
    if (symbolLine === cursorLine) return 5;
    if (Math.abs(symbolLine - cursorLine) <= 3) return 4;
    if (Math.abs(symbolLine - cursorLine) <= 10) return 3;
    if (Math.abs(symbolLine - cursorLine) <= 25) return 2;
    return 1;
  }

  /** Finalize — close any open scopes. */
  finalize(lastLine: number): void {
    this.lastLine = lastLine;
    for (const scope of this.stack) {
      if (scope.endLine === -1) {
        scope.endLine = lastLine;
      }
    }
  }
}
