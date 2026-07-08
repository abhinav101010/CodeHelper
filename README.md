# CodeHelper

A Chrome extension that brings VS Code–quality editor features to competitive programming websites.

**Supported sites:** LeetCode, CodeChef, CodeForces, HackerRank, AtCoder, GeeksforGeeks, HackerEarth

## Features

### ⌨️ VS Code–Style Snippets with Prefix Matching

Type a snippet prefix and press **Tab** to expand it into a full code block with placeholders. Suggestions appear as you type — no need to type the full prefix.

| Key | Action |
|-----|--------|
| **Tab** | Expand selected snippet, or move to next placeholder |
| **Shift+Tab** | Move to previous placeholder |
| **Escape** | Exit snippet mode / dismiss suggestions |
| **↑ / ↓** | Navigate through suggestions |
| **Enter** | Expand selected snippet |

**Example:** Type `fo` → widget shows `for`, `fori`, `forr`, `fore`. Press Tab to expand:

```cpp
for (int i = 0; i < n; i++) {
    // cursor here
}
```

Tab flow: `n` (selected) → Tab → `i` (selected, after loop body) → Tab → cursor after snippet, session ends.

- **Prefix matching** — Suggestions appear after typing just the first few characters (e.g. `if` shows all `if`-prefixed snippets).
- **Language-aware** — Only shows snippets for the currently selected language (Python snippets when Python is selected, C++ when C++ is selected, etc.).
- **Default placeholder text** — Placeholders like `${1:condition}` show default text that gets selected on arrival.
- **Mirrored placeholders** — Editing one placeholder updates all others with the same index.
- **Final cursor position** — `${0}` designates where the cursor lands after the last Tab.
- **Undo recovery** — Ctrl+Z / Cmd+Z after expanding a snippet resets state correctly; suggestions resume on next keystroke.

150+ built-in snippets covering **Python, C++, Java, JavaScript, TypeScript, Go, Rust, Ruby, PHP, Swift, Kotlin, Scala, and C#**. Custom snippets can be added via the options page.

### 🔄 Auto-Close Brackets and Quotes

Automatically closes `()`, `[]`, `{}`, `""`, `''`, and backticks as you type.

### 📐 Smart Indentation

Preserves and auto-adjusts indentation when pressing Enter after lines ending with `:`, `{`, `(`, `[`, etc.

### 🎨 Themes

16 dark editor themes: VS Code Dark, GitHub Dark, Monokai, One Dark, Dracula, Solarized Dark, Nord, Tokyo Night, Catppuccin Mocha, Ayu Dark, Gruvbox Dark, Material Palenight, Synthwave 84, Everforest Dark, Rose Pine Moon, Night Owl.

### 🔤 Fonts

Customize font family, size, line height, letter spacing, and ligatures. Defaults to JetBrains Mono at 14px.

### 🎨 Visual Enhancements

- **Line Highlight** — Highlight the current line (configurable color + opacity)
- **Bracket Pair Colorization** — Rainbow-coloured matching brackets
- **Indent Guides** — Vertical lines at each indentation level
- **Cursor Style** — Custom width, color, and blink style (smooth, phase, expand, solid)
- **Selection Style** — Custom selection background and foreground colours

### ⚡ Keyboard Shortcuts

12 built-in shortcuts (customizable via options page):

| Shortcut (Windows) | Shortcut (Mac) | Action |
|---------------------|----------------|--------|
| `Shift+Alt+↓` | `Shift+Option+↓` | Duplicate line down |
| `Ctrl+D` | `Cmd+D` | Duplicate selection or line |
| `Ctrl+Shift+K` | `Cmd+Shift+K` | Delete line |
| `Alt+↑` | `Option+↑` | Move line up |
| `Alt+↓` | `Option+↓` | Move line down |
| `Ctrl+Shift+/` | `Cmd+Shift+/` | Toggle line comment |
| `Ctrl+L` | `Cmd+L` | Select line |
| `Shift+Alt+F` | `Shift+Option+F` | Format document |
| `Tab` | `Tab` | Indent line |
| `Shift+Tab` | `Shift+Tab` | Outdent line |
| `Ctrl+Shift+J` | `Cmd+Shift+J` | Join lines |
| `Ctrl+Shift+L` | `Cmd+Shift+L` | Select all occurrences |

### 🌐 Multi-Site Support

| Site | Editor |
|------|--------|
| LeetCode | Monaco Editor |
| CodeChef | ACE Editor |
| CodeForces | CodeMirror |
| HackerRank | ACE Editor |
| AtCoder | CodeMirror |
| GeeksforGeeks | ACE Editor |
| HackerEarth | CodeMirror |

### 🔄 SPA Navigation

Automatically detects URL changes on single-page applications and re-initializes features without a page refresh.

## Architecture

### Dual-World Design

- **ISOLATED world** (`base.ts`) — Settings persistence via `chrome.storage`, forwards settings to MAIN world.
- **MAIN world** (`main.ts`) — Runs in page context with access to `window.monaco`, `window.ace`, etc. Applies all editor features.

Communication uses `window.postMessage` with retry logic and exponential backoff.

### Editor Adapters

Abstract adapter pattern (`EditorAdapter` interface) with implementations for Monaco, ACE, and CodeMirror (v5 + v6).

### Feature Engines

Each feature is a self-contained engine class with `constructor`, `updateSettings`, and `dispose` lifecycle methods.

## Installation

### From Source (Developer Mode)
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Open `chrome://extensions` in Chrome
5. Enable **Developer mode** (toggle in top-right)
6. Click **Load unpacked** and select the `dist/` directory
7. Navigate to any supported website

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
| `npm run dev` | Dev server with auto-rebuild |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | TypeScript type checking only |
| `npm run lint` | Lint all source files |
| `npm run zip` | Build and create `codehelper.zip` |

### Project Structure
```
src/
├── adapters/           # Editor adapters (Monaco, ACE, CodeMirror)
├── background/         # Service worker
├── content/            # Content scripts (ISOLATED + MAIN world)
├── core/               # Bridge, settings, language detection
├── features/
│   ├── snippets/       # Snippet engine, parser, widget, builtins
│   ├── themes/         # 16 editor themes
│   ├── fonts/          # Font configuration
│   ├── auto-close/     # Bracket/quote auto-close
│   ├── indentation/    # Smart indentation
│   ├── shortcuts/      # Keyboard shortcuts
│   ├── cursor/         # Cursor style
│   ├── selection/      # Selection style
│   ├── line-highlight/ # Current line highlight
│   ├── bracket-pairs/  # Rainbow bracket pairs
│   └── indent-guides/  # Indentation guides
├── types/              # TypeScript type definitions
└── ui/                 # Popup and options page
```

### Key Design Decisions

1. **No Monaco CompletionItemProvider** — Monaco 0.55.3 (LeetCode's build) crashes ALL autocomplete when any `CompletionItemProvider` is registered. Snippets use Tab-expand only with a custom DOM capture handler.

2. **Custom snippet parser** — Handles `$N`, `${N:placeholder}`, and `$VARIABLE` syntax without Monaco's broken `ISnippetString` pipeline.

3. **Prefix matching** — Widget shows snippets as user types partial prefixes (e.g. `fo` → `for`, `fori`), not just exact matches.

4. **Single suggestion source** — Monaco's native suggestions are fully disabled (`quickSuggestions: 'off'`). Only the custom SnippetSuggestWidget appears.

## Troubleshooting

### Snippets not showing
1. Ensure snippets are enabled in the extension popup/options
2. Check the console for `[CodeHelper]` log messages
3. Try refreshing the page

### Extension doesn't load after navigation
The extension monitors URL changes and re-initializes automatically. If features are missing after navigating:
1. Check console for `[CodeHelper] MAIN: URL changed, reinitializing`
2. If not present, try a full page refresh

### "Extension context invalidated" error
Happens when the extension is reloaded while the page is open. **Refresh the page** to restore.

## License

MIT
