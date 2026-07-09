# CodeHelper

A Chrome extension that brings **VS Code–quality editor features** to competitive programming websites.

**Supported sites:** LeetCode, CodeChef, CodeForces, HackerRank, AtCoder, GeeksforGeeks, HackerEarth

---

## Features

### ⌨️ VS Code–Style Snippets with Placeholder Navigation

Type a snippet prefix and press **Tab** to expand into a full code block. As you type, a **suggestion widget** shows available snippets matching what you've typed.

| Key | Action |
|-----|--------|
| **Tab** | Expand selected snippet / Accept first suggestion / Next placeholder |
| **Shift+Tab** | Previous placeholder |
| **Enter** | Expand selected suggestion |
| **↑ / ↓** | Navigate snippet suggestions |
| **Escape** | Exit snippet mode / Dismiss suggestions |

**Example — `if` + Tab:**

```python
# Before:
def func():
    ▊                    # cursor here (4 spaces indent)

# Type "if" and press Tab → expands to:
def func():
    if condition:▊       # "condition" is selected
        pass

# Press Tab → jumps to "pass":
def func():
    if condition:
        pass▊            # "pass" selected

# Press Tab → exits snippet mode, cursor after snippet
```

**Key behaviors:**
- **Prefix matching** — Type `i` and the widget shows `if`, `in`, etc. The **exact prefix match** always appears first.
- **Smart indentation** — Snippet continuation lines are indented relative to the current line (spaces or tabs, detected from editor settings).
- **Placeholder navigation** — `${1:condition}`, `${2:value}`, `${0:final}` work like VS Code. Tab advances, Shift+Tab retreats. `$0` is always the final stop.
- **Mirrored placeholders** — Editing one placeholder with a given index updates all placeholders sharing that index.
- **Active highlight** — The active placeholder gets a brighter background.
- **Click-outside / Escape** — Gracefully exits snippet mode.
- **Undo recovery** — Ctrl+Z after expansion resets all snippet state.

**150+ built-in snippets** for Python, C++, Java, JavaScript, TypeScript, Go, Rust, Ruby, PHP, Swift, Kotlin, Scala, C#. Add custom snippets via the options page.

### 🎨 Themes

16 dark editor themes applied **instantly** — no flash of default theme:

VS Code Dark, GitHub Dark, Monokai, One Dark, Dracula, Solarized Dark, Nord, Tokyo Night, Catppuccin Mocha, Ayu Dark, Gruvbox Dark, Material Palenight, Synthwave 84, Everforest Dark, Rose Pine Moon, Night Owl.

### 🔤 Fonts

Customize font family, size, line height, letter spacing, and ligatures (default: JetBrains Mono 14px).

### 🔄 Auto-Close Brackets & Quotes

Automatically closes `()`, `[]`, `{}`, `""`, `''`, and backticks. Uses Monaco's native handling to avoid conflicts.

### 📐 Smart Indentation

Auto-adjusts indentation when pressing Enter after `:`, `{`, `(`, `[`, etc.

### 🎨 Visual Enhancements

- **Line Highlight** — Current line background (configurable color + opacity)
- **Bracket Pair Colorization** — Rainbow-coloured matching brackets
- **Indent Guides** — Vertical lines at each indentation level
- **Cursor Style** — Width, color, blink style (smooth / phase / expand / solid)
- **Selection Style** — Background and foreground colours

### ⚡ Keyboard Shortcuts

12 built-in shortcuts (customizable via options page):

| Windows | Mac | Action |
|---------|-----|--------|
| `Shift+Alt+↓` | `Shift+Option+↓` | Duplicate line down |
| `Ctrl+D` | `Cmd+D` | Duplicate selection or line |
| `Ctrl+Shift+K` | `Cmd+Shift+K` | Delete line |
| `Alt+↑` | `Option+↑` | Move line up |
| `Alt+↓` | `Option+↓` | Move line down |
| `Ctrl+Shift+/` | `Cmd+Shift+/` | Toggle line comment |
| `Ctrl+L` | `Cmd+L` | Select line |
| `Shift+Alt+F` | `Shift+Option+F` | Format document |
| `Tab` | `Tab` | Indent / Accept snippet |
| `Shift+Tab` | `Shift+Tab` | Outdent / Previous placeholder |
| `Ctrl+Shift+J` | `Cmd+Shift+J` | Join lines |
| `Ctrl+Shift+L` | `Cmd+Shift+L` | Select all occurrences |

### 🌐 Multi-Site Support

| Site | Editor |
|------|--------|
| LeetCode | Monaco Editor (v0.55.3) |
| CodeChef | ACE Editor |
| CodeForces | CodeMirror |
| HackerRank | ACE Editor |
| AtCoder | CodeMirror |
| GeeksforGeeks | ACE Editor |
| HackerEarth | CodeMirror |

### 🔄 SPA Navigation

Detects URL changes on single-page apps and re-initializes features without a page refresh. Also monitors editor instances and re-creates the adapter if Monaco is re-initialized by the page.

---

## Architecture

### Dual-World Design

- **ISOLATED world** (`src/content/base.ts`) — Persists settings via `chrome.storage.sync`. Forwards changes to MAIN world.
- **MAIN world** (`src/content/main.ts`) — Full access to `window.monaco`, `window.ace`, etc. Applies all editor features.

Communication uses `window.postMessage` with a namespace bridge (`__CH_BRIDGE__`). The ISOLATED script also listens for `chrome.runtime.onMessage` from the popup/options page with robust context-invalidation guards.

### Editor Adapters

Abstract `EditorAdapter` interface with implementations for Monaco, ACE, and CodeMirror (v5 + v6). The Monaco variant supports direct editor construction (for LeetCode's custom build) and DOM-based discovery.

### Feature Engines

Each feature is a self-contained class with `constructor(adapter, settings)`, `updateSettings()`, and `dispose()` lifecycle methods. Engines are stored in `activeEngines[]` and replaced when settings change or the page navigates.

### Monaco 0.55.3 Compatibility

LeetCode uses a custom Monaco v0.55.3 build with **multiple internal bugs** in the suggestion and snippet pipeline:

| Bug | Symptom | Mitigation |
|-----|---------|------------|
| `e.text.replaceAll is not a function` | All autocomplete breaks after first Tab-accepted suggestion | `tabCompletion: 'off'` — we handle Tab via DOM capture handler |
| `e.replace is not a function` | Suggestion preview crashes | `preview: false` |
| Completions with non-string values crash `_computeFn` | Suggestion pipeline enters corrupted state | `showSnippets: false`, `showKeywords: false`, `showWords: false` — only our custom widget provides suggestions |
| Cascading computed-property failures | Errors propagate into unrelated event handlers | Three-layer error swallowing: `onUnexpectedError`, global `error` (capture), global `unhandledrejection` |

**Critical rule: Never register a Monaco `CompletionItemProvider`.** Even with `kind: CompletionItemKind.Text` and plain-text `insertText`, it corrupts the suggestion pipeline. The snippet widget is a pure HTML/CSS overlay.

### Custom Snippet Parser

Reimplements VS Code's snippet syntax without relying on Monaco's broken `ISnippetString`:
- `$N` — simple tabstop
- `${N:text}` — tabstop with default placeholder text
- `$VARIABLE` — variable references (`$TM_FILENAME`, `$CLIPBOARD`, etc.)

---

## Installation

### From Source (Developer Mode)
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Open `chrome://extensions`
5. Enable **Developer mode** (top-right toggle)
6. Click **Load unpacked** → select the `dist/` directory
7. Navigate to any supported website

---

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup
```bash
git clone <repo-url>
cd codehelper
npm install
```

### Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with auto-rebuild (Vite watch) |
| `npm run build` | Full production build |
| `npm run typecheck` | TypeScript type checking only |
| `npm run lint` | ESLint check |
| `npm run zip` | Build + create `codehelper.zip` for distribution |

### Project Structure
```
src/
├── adapters/           # Editor adapters (Monaco, ACE, CodeMirror)
├── background/         # Service worker (chrome.runtime)
├── content/            # Content scripts (ISOLATED + MAIN worlds)
├── core/               # Bridge, settings, language detection, injector
├── features/
│   ├── snippets/       # SnippetEngine, SnippetSession, widget, parser, builtins
│   ├── themes/         # 16 editor themes + early theme application
│   ├── fonts/          # Font configuration
│   ├── auto-close/     # Bracket/quote auto-close engine
│   ├── indentation/    # Smart indentation engine
│   ├── shortcuts/      # Keyboard shortcut engine
│   ├── cursor/         # Cursor style engine
│   ├── selection/      # Selection style engine
│   ├── line-highlight/ # Current line highlight engine
│   ├── bracket-pairs/  # Rainbow bracket pair engine
│   └── indent-guides/  # Indentation guide engine
├── types/              # Shared TypeScript type definitions
└── ui/                 # Popup + options page (Preact)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/features/snippets/engine.ts` | SnippetEngine (expansion, matching) + SnippetSession (tab-stop navigation) |
| `src/features/snippets/widget.ts` | Custom HTML overlay snippet suggestion widget |
| `src/features/snippets/parser.ts` | VS Code–style snippet body parser (`$N`, `${N:text}`, `$VARIABLE`) |
| `src/features/snippets/builtins.ts` | 150+ built-in snippets across 13 languages |
| `src/content/main.ts` | Init, feature application, settings listener, SPA navigation |
| `src/content/base.ts` | ISOLATED world — chrome.storage settings, context-invalidation guards |
| `src/core/bridge.ts` | ISOLATED↔MAIN communication via `window.postMessage` |
| `src/adapters/monaco.ts` | Monaco Editor adapter (0-based ↔ 1-based position translation) |
| `src/features/themes/engine.ts` | Theme definition + early Monaco theme application |

---

## Troubleshooting

### Snippet widget doesn't appear
1. Open the extension popup and verify snippets are **enabled**
2. Open DevTools console and filter by `[CodeHelper]`
3. Look for `ISOLATED: init` and `MAIN: init` — if missing, try refreshing the page
4. If `MAIN: waiting for Monaco editor` appears but never resolves, LeetCode may be using a non-standard editor layout
5. Check that you're on a **problem page** (not the description-only view)

### Monaco autocomplete broken after reload
The extension disables Monaco's native autocomplete (`quickSuggestions: 'off'`) to prevent internal crashes. Only the custom snippet widget provides suggestions. This is intentional.

If Monaco's native suggestions don't appear and neither does the widget:
1. Refresh the page (full reload, not SPA navigation)
2. If still broken, reload the extension from `chrome://extensions`

### "Extension context invalidated" error
This occurs when the extension is reloaded (e.g. after `npm run build` + chrome://extensions reload) while the page is still open. **Refresh the page** to restore functionality.

### Snippet expands with wrong indentation
The extension detects Monaco's `insertSpaces` and `tabSize` settings from the editor model. If these aren't available (e.g. on page load before the model is ready), it falls back to tab characters. Try typing a character first to ensure the model is initialized, then expand the snippet.

### Snippet navigation (Tab/Shift+Tab) stops working
- Press **Escape** to exit snippet mode manually
- Click outside the snippet area to trigger exit
- Ctrl+Z also resets snippet state

### Page navigation doesn't reinitialize
The extension monitors URL changes every 1 second and overrides `pushState`/`replaceState`. If features are missing after navigation, check the console for `URL changed, reinitializing`. If absent, do a full page refresh.

---

## Known Limitations

- **LeetCode only** — Monaco's broken snippet pipeline limits full snippet support to LeetCode. Other sites use simpler Tab-expand without placeholder navigation.
- **Language detection** — Relies on Monaco's `model.getLanguageId()`. If the model language isn't set (rare), all snippets are shown regardless of language.
- **Monaco v0.55.3 only** — Newer Monaco versions may not have the same bugs but haven't been tested. The custom adapter may require adjustments.

---

## License

MIT
