# CodeHelper

A browser extension that supercharges competitive programming editors (LeetCode, CodeChef, CodeForces, HackerRank, AtCoder, GeeksforGeeks, HackerEarth) with VS Code–style productivity features.

## Features

### 📝 Snippet Expansion (Tab-Stop Navigation)

Type a prefix and press **Tab** to expand it into a full code block. Supports VS Code–style placeholders:

```python
# Type: if + Tab → expands to:
if condition:
    pass
# Press Tab → selects "condition" (edit it)
# Press Tab → selects "pass" (edit it)
# Press Tab → cursor moves after the snippet, snippet mode ends
```

**Placeholder features:**
- **Tab** — move to next placeholder
- **Shift+Tab** — move to previous placeholder
- **Escape** — exit snippet mode
- **`${1:default}`** — tabstops with default text (auto-selected)
- **`${0}`** — final cursor position
- **Mirrored placeholders** — editing one placeholder automatically updates all placeholders with the same index
- **Auto-finish** — typing at the last placeholder (`$0`) automatically exits snippet mode and resumes normal suggestions
- **Highlighted active placeholder** — yellow background highlights the currently edited placeholder
- **Click-outside detection** — clicking outside the snippet structure exits snippet mode
- **Undo recovery** — pressing Ctrl+Z after snippet expansion properly resets all state

#### Built-in Snippets (Python)

| Prefix | Description |
|--------|-------------|
| `if` | If statement |
| `elif` | Elif statement |
| `else` | Else statement |
| `for` / `fori` | For loop (range) |
| `forr` / `fore` | For-each loop |
| `while` | While loop |
| `def` | Function definition |
| `class` | Class definition |
| `try` | Try-except block |
| `si` | Fast input (sys.stdin.readline) |
| `rint` | Read integer |
| `readline` | Read line as list |
| `ints` | Read integer list |
| `arr` | Read array of integers |
| `read2` | Read two integers |
| `read3` | Read three integers |
| `readn` / `reads` | Read n and array |
| `printv` | Print variables |
| `p` | Print with `sep` and `end` |
| `pp` | Pretty print (pprint) |
| `main` | Main function guard |
| `lc` | List comprehension |
| `dc` | Dict comprehension |
| `sc` | Set comprehension |
| `enum` | Enumerate |
| `zip` | Zip |
| `range` | Range loop |
| `sorted` | Sorted |
| `reversed` | Reversed |
| `filter` | Filter |
| `map` | Map |
| `lambda` | Lambda |
| `deque` | Collections deque |
| `defaultdict` | Collections defaultdict |
| `Counter` | Collections Counter |
| `heapq` | Heapq import |
| `bisect` | Bisect import |
| `math` | Math import |
| `gcd` | Math gcd/lcm |
| `comb` | Math comb/perm |
| `inf` | Float infinity |
| `maxint` | Maximum integer constant |

### 💡 Smart Suggestion Widget

As you type, a floating suggestions box appears showing matching snippets and local identifiers. The widget:

- **Appears near the cursor** — uses Monaco's `getScrolledVisiblePosition` for accurate positioning
- **Renders above ALL elements** — uses maximum z-index (`2147483647`)
- **Shows snippet prefix + description + body preview** — so you can see what you're about to expand
- **Shows local identifiers with type badges** — `var`, `fn`, `cls`, `par`, `it`, `fld` badges for quick recognition
- **Prioritizes relevance** — exact matches first, then scope-relevant identifiers, then partial matches
- **Supports keyboard navigation** — ArrowUp/ArrowDown, Enter/Tab to accept, Escape to dismiss
- **Auto-dark/light theme detection** — checks page background luminance

### 🔍 Local Identifier Autocomplete (Offline, No AI)

The extension parses your editor content and builds a live symbol index as you type — fully offline with no external API calls:

- Extracts **variables**, **functions**, **classes**, **parameters**, and **loop variables** using lightweight regex parsers
- **Language-aware** — supports Python, C, C++, Java, JavaScript, TypeScript, Go, Rust with distinct regex patterns
- **Scope-aware** — prioritizes identifiers from the current function/class scope
- **Usage-ranked** — recently used identifiers appear higher in suggestions
- **Deduplicated** — same identifier doesn't appear twice regardless of how many times it's in scope
- **Real-time updates** — index rebuilds on a 200ms debounce as you edit
- **Merged with snippets** — identifier and snippet suggestions appear in the same unified widget

### 🎨 Theme & Visual Enhancements

- **Monaco theme applied early** — no flash of default theme; themes load as soon as `window.monaco` is available
- **Custom fonts** — JetBrains Mono, Fira Code, Cascadia Code, or any system monospace font
- **Line highlighting** — subtle background on the current line
- **Bracket pair colorization** — matching brackets in distinct colors
- **Indent guides** — vertical lines at each indentation level
- **Custom cursor** — adjustable width, color, and blink style (smooth, phase, expand, solid)
- **Custom selection** — configurable background and foreground colors

### ⌨️ Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| **Tab** | Suggestion widget visible | Accept selected suggestion (primary accept key) |
| **Tab** | No widget, word matches snippet | Expand snippet |
| **Tab** | Active snippet session | Advance to next placeholder |
| **Shift+Tab** | Active snippet session | Return to previous placeholder |
| **Enter** | Suggestion widget visible with selection | Accept selected suggestion |
| **Enter** | Suggestion widget visible without selection | Hide widget, insert newline |
| **ArrowUp** | Widget visible | Select previous item |
| **ArrowDown** | Widget visible | Select next item |
| **Escape** | Widget visible | Dismiss widget |
| **Escape** | Active snippet session | Exit snippet mode |
| **Ctrl+Z** | After snippet expansion | Reset snippet state (undo) |

### ⚙️ Custom Snippets

Add your own snippets via the extension options page or popup. Custom snippets are stored in `chrome.storage` and synchronized across browser sessions.

**Format:**
```javascript
{
  prefix: ["mytrigger"],
  body: "function ${1:name}(${2:args}) {\n\t${0}\n}",
  description: "My custom function",
  language: ["javascript", "typescript"]
}
```

## Installation

### Manual Installation (Developer Mode)
1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Open Chrome → `chrome://extensions`
5. Enable **Developer mode**
6. Click **Load unpacked** and select the `dist/` folder

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Type-check only
npm run typecheck
```

### Project Structure

```
src/
├── adapters/              # Editor adapters (Monaco, ACE, CodeMirror)
│   ├── monaco.ts          # Monaco adapter (primary, used by LeetCode)
│   ├── ace.ts             # ACE editor adapter (CodeChef, HackerRank)
│   ├── codemirror.ts      # CodeMirror adapter (CodeForces, HackerEarth)
│   └── types.ts           # Adapter interface
├── content/
│   ├── main.ts            # MAIN world — feature initialization, adapter setup
│   └── base.ts            # ISOLATED world — settings management via chrome.storage
├── core/
│   ├── bridge.ts          # ISOLATED ↔ MAIN message bridge (postMessage)
│   ├── language.ts        # Language detection + normalization
│   ├── settings.ts        # Settings manager (chrome.storage wrapper)
│   └── observer.ts        # DOM mutation observer helpers
├── features/
│   ├── snippets/          # Snippet engine + tab-stop navigation
│   │   ├── engine.ts      # SnippetSession + SnippetEngine (core logic, ~1730 lines)
│   │   ├── widget.ts      # Custom suggestion overlay (raw HTML, no Monaco APIs)
│   │   ├── parser.ts      # Snippet template parser ($N, ${N:text}, $VAR)
│   │   ├── builtins.ts    # 150+ Python snippet definitions
│   │   └── templates.ts   # Variable resolver ($TM_FILENAME, $CLIPBOARD, etc.)
│   ├── autocomplete/      # Local identifier autocomplete index
│   │   └── index.ts       # IdentifierIndex — regex-based symbol extractor + matcher
│   ├── themes/            # Monaco theme application (dark themes only)
│   ├── fonts/             # Custom font injection (@font-face)
│   ├── line-highlight/    # Current line background highlighting
│   ├── bracket-pairs/     # Bracket pair colorization using Monaco decorators
│   ├── indent-guides/     # Indentation guide lines
│   ├── cursor/            # Custom cursor style (width, color, blink)
│   ├── selection/         # Custom selection background/foreground
│   ├── auto-close/        # Auto-closing brackets/quotes
│   ├── indentation/       # Smart indentation engine
│   └── shortcuts/         # Custom keyboard shortcut mappings
├── ui/
│   ├── popup/             # Extension popup (enable/disable features per site)
│   └── options/           # Options page (theme, font, custom snippets)
├── types/                 # TypeScript type definitions
│   ├── snippet.ts         # Snippet, TabstopInfo, ParsedSnippet
│   ├── settings.ts        # Settings, Features, sub-settings
│   └── messages.ts        # Bridge message types
├── manifest.ts            # Chrome manifest V3 generator
└── background/            # Service worker (minimal — most logic in content scripts)
```

## Architecture

### Two-World Architecture

The extension uses Chrome's ISOLATED and MAIN world content scripts:

- **ISOLATED world** (`base.ts`) — has access to `chrome.*` APIs. Manages settings storage via `chrome.storage`. Listens for popup/options changes. Communicates with the MAIN world via `window.postMessage` bridge.
- **MAIN world** (`main.ts`) — runs in the page's JavaScript context. Has direct access to `window.monaco`, `window.ace`, etc. Applies all editor features. Falls back to default settings if ISOLATED world is unavailable (e.g., after extension reload).

### Message Bridge

The bridge (`bridge.ts`) provides reliable ISOLATED↔MAIN communication:

| Method | Use Case | Retries | Timeout |
|--------|----------|---------|---------|
| Fire-and-forget (direct postMessage) | Initial settings push (ISOLATED → MAIN) | 0 | N/A |
| Request-response (`sendWithRetry`) | SETTINGS_REQUEST (MAIN → ISOLATED) | 3 (exponential backoff) | 2s per attempt |
| Request-response (`sendWithRetry`) | SETTINGS_UPDATE (ISOLATED → MAIN) | 3 (exponential backoff) | 2s per attempt |

### Snippet Engine Architecture

The snippet system (`engine.ts`) is designed to work around Monaco 0.55.3's bugs:

1. **No Monaco CompletionItemProvider** — Monaco 0.55.3 (LeetCode's custom build) has a buggy snippet pipeline that crashes ALL autocomplete when any `CompletionItemProvider` is registered. The extension completely bypasses this and uses its own custom widget.

2. **Capture-phase keydown handler** — Intercepts Tab/Enter BEFORE Monaco processes them, at the `document` level with `{ capture: true }`. This ensures the extension handles Tab for snippet expansion before Monaco can insert a tab character.

3. **Monaco decorations for live tabstop tracking** — Instead of storing fixed character offsets, the `SnippetSession` creates Monaco decorations (one per tabstop) and reads their current ranges via `model.getDecorationRange()`. Monaco's model automatically adjusts decoration ranges when text is inserted or deleted before them, providing VS Code–level robustness.

4. **Single atomic replace** — The trigger word is replaced with the full expanded body in one `executeEdits` call. No delete-then-insert race conditions.

5. **Safety timer** — A 3-second safety timer prevents `suppressWidget` from getting stuck permanently after a failed expansion.

6. **Monaco error swallowing** — Three layers of error handling (onUnexpectedError, global error event, unhandledrejection) prevent Monaco's internal `replaceAll is not a function` crash from breaking the editor.

### Content Change Flow

```
User types "if"
  → Monaco onDidChangeModelContent fires
  → registerContentListener() schedules update (10ms debounce)
  → _performUpdate() reads cursor, finds word "if"
  → _computeMatches("if") finds matching snippets + identifiers
  → suggestWidget.show() displays dropdown near cursor

User presses Tab
  → Capture-phase keydown handler intercepts
  → suggestWidget.getSelected() returns "if" snippet
  → expandTrigger() sets suppressWidget=true
  → replaceRange({triggerStart, cursor}, "if condition:\n    pass")
  → SnippetSession created with decorations
  → session.advance() moves to first placeholder "condition"
  → suppressWidget=false, _scheduleUpdate() called
  → _performUpdate() sees active session, hides widget

User edits "condition" → types "value"
  → Content change triggers mirrored placeholder update
  → session still active

User presses Tab again
  → session.advance() moves to "pass" ($0)

User presses Tab again
  → session.advance() past last tabstop → session destroyed
  → onDestroy callback: session=null, _scheduleUpdate()
  → _performUpdate() reads cursor, finds matches, shows widget

User types "if" at final position
  → session.isAtLastTabstop() is true
  → Auto-finish: session destroyed, suppressWidget cleared
  → Widget shows "if" snippet matching — ready for next expansion
```

## Troubleshooting

### Suggestions not showing
1. Open browser DevTools console — look for `[CodeHelper]` log messages
2. Reload the page (not just the extension — this re-injects content scripts)
3. Check that snippets are enabled in the extension popup
4. Verify the correct language is detected (console shows detected site)
5. If "Extension context invalidated" appears, reload the page

### "Extension context invalidated" error
This happens when the extension is reloaded (e.g., during development) while pages are still open. The ISOLATED world loses its `chrome.runtime` connection. **Reload the page** to re-inject fresh content scripts. The extension now includes a fallback: the MAIN world uses default settings when ISOLATED is unreachable, so features still work.

### Theme not applying
The extension applies themes as early as possible — as soon as `window.monaco.editor.defineTheme` is available. If the theme doesn't apply:
1. Check if the theme name matches one of the built-in themes
2. Reload the page
3. Check console for Monaco theme errors

### Snippet indentation looks wrong
The extension automatically adjusts snippet indentation based on the current line's indent level and the editor's tab settings (spaces vs. tabs). If indentation looks wrong:
1. Check the editor's indent settings in LeetCode's settings panel
2. The `\t` in snippet bodies means "one level of indentation relative to current line"
3. Try expanding the snippet at the top level (no indentation) to verify the body itself is correct

### Mirrored placeholders not updating
Mirrored placeholders (same tabstop index appearing multiple times in a snippet) should all update when you edit one. If they don't:
1. Check that the snippet uses identical `${N:text}` for mirrored positions
2. Verify the editor is focused
3. If the decorations were lost, the session may have been destroyed — re-expand the snippet

## Supported Sites

| Site | Editor | Status |
|------|--------|--------|
| LeetCode | Monaco 0.55.3 | ✅ Primary target, fully tested |
| CodeChef | ACE | ✅ Tested |
| CodeForces | CodeMirror | ✅ Tested |
| HackerRank | ACE | ✅ Tested |
| AtCoder | CodeMirror | ✅ Tested |
| GeeksforGeeks | ACE | ✅ Tested |
| HackerEarth | CodeMirror | ✅ Tested |

## License

MIT
