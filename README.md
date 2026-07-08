# CodeHelper

A Chrome extension that brings VS Code–quality editor features to competitive programming websites (LeetCode, CodeChef, CodeForces, HackerRank, AtCoder, GeeksforGeeks, HackerEarth).

## Features

### 🎨 Themes
Apply popular dark editor themes directly to the embedded code editors. Choose from 16+ themes including VS Code Dark, GitHub Dark, Monokai, One Dark, Dracula, Nord, Tokyo Night, Catppuccin, Ayu Dark, Gruvbox Dark, and more. Custom color overrides are supported.

### 🔤 Fonts
Customize the editor font family, size, line height, letter spacing, and enable/disable ligatures. Works with any system font, including popular coding fonts like JetBrains Mono, Fira Code, Cascadia Code, and Source Code Pro.

### ⌨️ VS Code–Style Snippets with Tab-Stop Navigation
Type a snippet prefix and press **Tab** to expand it into a full code block with placeholders. Navigate through placeholders just like VS Code:

| Key | Action |
|-----|--------|
| **Tab** | Move to the next placeholder |
| **Shift+Tab** | Move to the previous placeholder |
| **Escape** | Exit snippet mode immediately |
| **Click outside** | Automatically exits snippet mode |

- **Default placeholder text** — Placeholders like `${1:condition}` show default text that gets selected on arrival so you can type over it.
- **Mirrored placeholders** — Editing one placeholder updates all other placeholders with the same index (e.g., a variable name that appears multiple times).
- **Final cursor position** — `${0}` designates where the cursor lands after the last Tab. Pressing Tab after `$0` exits snippet mode.
- **Highlighting** — Active placeholder is highlighted with a distinct background color; inactive placeholders have a subtle highlight.

### 🔍 Snippet Suggest Widget
As you type, a floating dropdown shows available snippets that match what you've typed. The widget only shows snippets that **Tab would actually expand**, so it's a reliable preview:

- Type `i` → shows `if`, `in`, `import`, etc.
- Type `if` → shows only the `if` snippet
- Press **Tab** or **Enter** to expand the selected snippet
- Press **Escape** or click outside to dismiss
- Press **↑** / **↓** to navigate through suggestions

**Example:** Type `if` and press Tab to get:

```python
if condition:
    pass
```

Tab flow: `condition` (selected) → Tab → `pass` (selected) → Tab → cursor after snippet, session ends.

The extension includes 150+ built-in snippets covering Python, C++, Java, JavaScript, TypeScript, and more. Custom snippets can be added via the settings.

### Implementation Note
Snippets use **Tab-expand only** through a custom engine — no Monaco `CompletionItemProvider` is registered. This avoids a bug in Monaco 0.55.3 (LeetCode's build) where the suggestion pipeline crashes on certain string operations, breaking ALL autocomplete. The snippet suggest widget is a pure HTML/CSS overlay that doesn't touch Monaco's suggestion API.

### 🎯 Smart Autocomplete Configuration
Configures Monaco's built-in autocomplete to match VS Code's behaviour: quick suggestions on by default, word-based suggestions from the current document, keyword and snippet suggestions shown, parameter hints enabled, and suggestions preview enabled.

### 🔄 Auto-Close Brackets and Quotes
Automatically closes `()`, `[]`, `{}`, `""`, `''`, and backticks as you type. Configurable via settings.

### 📐 Smart Indentation
Preserves and auto-adjusts indentation when pressing Enter after lines ending with `:`, `{`, `(`, `[`, and more.

### 🎨 Visual Enhancements
- **Line Highlight** — Highlight the current line with a configurable colour and opacity.
- **Bracket Pair Colorization** — Rainbow-coloured matching brackets for easier scope navigation.
- **Indent Guides** — Vertical lines at each indentation level.
- **Cursor Style** — Customisable cursor width, colour, and blink style (smooth, phase, expand, solid).
- **Selection Style** — Customisable selection background and foreground colours.

### ⚡ Keyboard Shortcuts
Register custom keyboard shortcuts for common actions. Ships with 12 built-in shortcuts.

### 🌐 Multi-Site Support
Works on all major competitive programming platforms:
- **LeetCode** — Monaco Editor
- **CodeChef** — ACE Editor
- **CodeForces** — CodeMirror
- **HackerRank** — ACE Editor
- **AtCoder** — CodeMirror
- **GeeksforGeeks** — ACE Editor
- **HackerEarth** — CodeMirror

### 🔄 SPA Navigation
Automatically detects URL changes on single-page applications (like LeetCode's problem navigator) and re-initializes features without requiring a page refresh.

## Architecture

### Dual-World Design
Chrome extension content scripts have two execution contexts. CodeHelper uses both:

- **ISOLATED world** (`base.ts`) — Has access to `chrome.runtime` and `chrome.storage`. Manages settings persistence and forwards settings to the MAIN world.
- **MAIN world** (`main.ts`) — Runs in the page's JavaScript context. Has access to `window.monaco`, `window.ace`, etc. Applies all editor features.

Communication between the two worlds uses `window.postMessage` with a custom namespace (`__CH_BRIDGE__`), with retry logic and exponential backoff for reliability.

### Editor Adapters
The extension uses an adapter pattern to abstract away editor-specific APIs:

- **MonacoAdapter** — For LeetCode's Monaco Editor (primary target)
- **ACE / CodeMirror adapters** — For other platforms

### Feature Engines
Each feature is implemented as a self-contained engine class with a standard lifecycle (`constructor`, `updateSettings`, `dispose`). Engines are created during `applyFeatures()` and disposed on re-initialization.

## Installation

### From Source (Developer Mode)
1. Clone this repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Open `chrome://extensions` in Chrome.
5. Enable **Developer mode** (toggle in top-right).
6. Click **Load unpacked** and select the `dist/` directory.
7. Navigate to any supported website (e.g., LeetCode).

### From Chrome Web Store (Coming Soon)
Once published, install directly from the Chrome Web Store.

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
| `npm run dev` | Start dev server (Vite watch mode, auto-rebuilds) |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | Run TypeScript type checking only |
| `npm run lint` | Lint all source files |
| `npm run test` | Run unit tests |
| `npm run zip` | Build and create `codehelper.zip` for distribution |

### Project Structure
```
src/
├── adapters/           # Editor adapters (Monaco, ACE, CodeMirror)
│   ├── monaco.ts       # Monaco Editor adapter
│   ├── ace.ts          # ACE Editor adapter
│   ├── codemirror.ts   # CodeMirror adapter
│   └── types.ts        # Adapter interfaces
├── background/         # Service worker
├── content/            # Content scripts
│   ├── base.ts         # ISOLATED world (settings, storage)
│   ├── main.ts         # MAIN world (editor features)
│   └── main-world/     # Per-site entry points
├── core/               # Shared core utilities
│   ├── bridge.ts       # ISOLATED ↔ MAIN communication
│   ├── injector.ts     # Style injection
│   ├── language.ts     # Language detection
│   ├── observer.ts     # DOM observation
│   └── settings.ts     # Settings management
├── features/           # Feature implementations
│   ├── snippets/       # Snippet engine (parser, tab-stops)
│   ├── themes/         # Theme engine
│   ├── fonts/          # Font engine
│   ├── auto-close/     # Auto-close brackets/quotes
│   ├── indentation/    # Smart indentation
│   ├── shortcuts/      # Keyboard shortcuts
│   ├── cursor/         # Cursor style
│   ├── selection/      # Selection style
│   ├── line-highlight/ # Current line highlight
│   ├── bracket-pairs/  # Rainbow bracket pairs
│   └── indent-guides/  # Indentation guides
├── types/              # TypeScript type definitions
└── ui/                 # Extension UI (popup, options page)
    ├── popup/          # Popup (toolbar icon click)
    ├── options/        # Options page
    ├── components/     # Shared UI components
    └── shared/         # Shared styles, utilities
```

### Key Design Decisions

1. **No Monaco CompletionItemProvider** — Monaco 0.55.3 (used by LeetCode) has a buggy snippet-processing pipeline that crashes ALL autocomplete when any `CompletionItemProvider` is registered, even with `kind: Text`. Snippets use **Tab-expand only**: type a prefix and press Tab.

2. **Own snippet parser** — The `parseSnippet()` function handles `$N`, `${N:placeholder}`, and `$VARIABLE` syntax. This avoids Monaco's broken `ISnippetString` pipeline entirely.

3. **SPA navigation detection** — LeetCode uses React Router. The extension polls the URL (every 1s), overrides `pushState`/`replaceState`, and listens for `popstate` to detect navigation and re-initialize features.

4. **Bridge with retry** — ISOLATED ↔ MAIN communication uses `window.postMessage` with 3 retries and exponential backoff (300ms/600ms/1200ms) to handle timing races.

## Troubleshooting

### Native autocomplete stops working on LeetCode
This was caused by Monaco 0.55.3's internal snippet pipeline crashing when processing suggestion text. The extension now works around this by:
- **Disabling Monaco's built-in tab-completion** (`tabCompletion: 'off'`) — CodeHelper handles snippet expansion entirely through its own DOM-level Tab handler, avoiding Monaco's buggy pipeline.
- **Setting `showSnippets: false` and `preview: false`** in Monaco's suggestion settings to prevent the broken code paths from executing.
- **Installing the error handler before Monaco is ready** — catching internal errors earlier prevents state corruption.
- **Not registering any `CompletionItemProvider`** (the Tab-expand approach avoids the buggy suggestion pipeline entirely).

If native autocomplete still doesn't appear:
1. Open the browser console (F12) and check for red errors.
2. Look for `[CodeHelper]` log messages to confirm the extension loaded.
3. Try refreshing the page once.

### Snippet suggest widget doesn't show or shows wrong snippets
The widget uses the **exact same matching logic** as the Tab key handler (`findTriggerWord()`). It only shows snippets where:
- The text before the cursor **ends with** the snippet prefix
- There's a word boundary (space, bracket, operator, etc.) before the prefix

If the widget isn't showing:
1. Make sure snippets are enabled in the extension's popup/options.
2. Type a complete prefix (e.g., `if` with a space before it or at line start).
3. Check the console for `[CodeHelper] SnippetEngine` logs.

### Extension doesn't load after navigation
The extension monitors URL changes and re-initializes automatically. If features are missing after navigating to a new problem:
1. Check the console for `[CodeHelper] MAIN: URL changed, reinitializing`.
2. If not present, try a full page refresh.

### "Extension context invalidated" error
This happens when the extension is reloaded (e.g., from `chrome://extensions`) while the page is open. The ISOLATED world can no longer access `chrome.*` APIs. The extension now handles this gracefully:
- Settings loading is wrapped in try-catch
- A context validity check runs before accessing `chrome.runtime` or `chrome.storage`
- Falls back to default settings if context is invalid

To fully restore: **Refresh the page.**

### Snippet Tab expansion doesn't work
- Make sure snippets are enabled in the extension popup/options.
- Type the full prefix (e.g., `if`) at the start of a line or after a space, then press Tab.
- The extension now handles Tab via a DOM capture-phase listener that fires before Monaco processes it. If Monaco's native suggest widget is visible, Tab will accept the Monaco suggestion instead — type the prefix and press Tab when no Monaco suggestion is highlighted.
- Check the console for `[CodeHelper] SnippetEngine` logs.

## License

MIT
