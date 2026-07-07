# CodeHelper

A Chrome extension that brings **VS Code-quality editor features** to competitive programming websites. Works with Monaco (LeetCode), Ace (CodeChef, HackerRank, GeeksforGeeks), and CodeMirror (Codeforces, AtCoder, HackerEarth) editors.

## Features

### 🎨 16 Premium Themes

Apply VS Code-quality color themes to any editor. Every theme is a faithful port of a popular VS Code theme — not a generic syntax highlighter.

| Theme | Theme | Theme | Theme |
|-------|-------|-------|-------|
| VS Code Dark+ | GitHub Dark | Monokai | One Dark |
| Dracula | Solarized Dark | Nord | Tokyo Night |
| Catppuccin Mocha | Ayu Dark | Gruvbox Dark | Material Palenight |
| SynthWave '84 | Everforest Dark | Rosé Pine Moon | Night Owl |

### ⌨️ VS Code Keyboard Shortcuts

All the editor shortcuts you're used to, now on CP sites:

| Shortcut | macOS | Windows/Linux | Action |
|----------|-------|---------------|--------|
| Duplicate Line | `⌘D` / `⇧⌥↓` | `Ctrl+D` / `⇧⌥↓` | Duplicate selection or line |
| Delete Line | `⌘⇧K` | `Ctrl+⇧K` | Delete current line |
| Move Line Up/Down | `⌥↑` / `⌥↓` | `⌥↑` / `⌥↓` | Move line |
| Toggle Comment | `⌘⇧/` | `Ctrl+⇧/` | Toggle line comment |
| Select Line | `⌘L` | `Ctrl+L` | Select entire line |
| Join Lines | `⌘⇧J` | `Ctrl+⇧J` | Join current and next line |
| Select All Occurrences | `⌘⇧L` | `Ctrl+⇧L` | Multi-select all occurrences |
| Indent / Outdent | `Tab` / `⇧Tab` | `Tab` / `⇧Tab` | Indent/outdent line |
| Format Document | `⇧⌥F` | `⇧⌥F` | Format code |

### 📝 Code Snippets (150+)

Expressive snippet engine with built-in templates for competitive programming. Type a prefix + `Tab` to expand.

**Python** — Loops & conditionals, I/O helpers (`ints`, `readline`, `readgrid`, `printarr`), data structures (`graph`, `matrix`, `deque`, `heapq`, `bisect`, `Counter`, `defaultdict`), algorithms (`bfs`, `dfs`, `dijkstra`, `binarysearch`, `sieve`, `lcs`, `knap`, `lis`), and more.

**C++** — Loops & conditionals, fast I/O (`ios`), STL containers (`vector`, `map`, `set`, `unordered_map`), algorithms (`sort`, `binary_search`, `lower_bound`), and more.

Snippets appear in the autocomplete dropdown (Monaco) or expand via Tab (all editors). You can add custom snippets in the settings page.

### 🔗 Rainbow Brackets

Bracket pair colorization with independent color pools per bracket type. `()`, `[]`, `{}` each get their own color palette — the same feature that makes VS Code's code so readable.

### 📏 Indentation Guides

Vertical rulers at each indentation level. Color-customizable.

### 🖱️ Enhanced Cursor & Selection

- Adjustable cursor width, color, and blink style (`smooth` | `phase` | `expand` | `solid`)
- Customizable selection background and foreground colors

### 🎯 Line Highlighting

Highlight the current line with a customizable color and opacity.

### 🔄 Smart Auto-Close

Auto-close brackets and quotes: `(`, `[`, `{`, `"`, `'`, `` ` ``. Pair configuration is customizable.

### 📐 Smart Indentation

Auto-indent on Enter after `{`, `:`, etc. Tab/Shift-Tab for indent/outdent.

### 🔤 Customizable Font

Configure font family, size, line height, letter spacing, and ligatures.

## Supported Sites

| Site | Editor | Features |
|------|--------|----------|
| [LeetCode](https://leetcode.com) | Monaco | Full support — themes, snippets, shortcuts, brackets, guides, auto-close, cursor, selection, line highlight, indentation |
| [CodeChef](https://codechef.com) | Ace | Themes, snippets, shortcuts, auto-close, indentation |
| [Codeforces](https://codeforces.com) | CodeMirror | Themes, snippets, shortcuts, auto-close, indentation |
| [HackerRank](https://hackerrank.com) | Ace | Themes, snippets, shortcuts, auto-close, indentation |
| [AtCoder](https://atcoder.jp) | CodeMirror | Themes, snippets, shortcuts, auto-close, indentation |
| [GeeksforGeeks](https://geeksforgeeks.org) | Ace | Themes, snippets, shortcuts, auto-close, indentation |
| [HackerEarth](https://hackerearth.com) | CodeMirror | Themes, snippets, shortcuts, auto-close, indentation |

## Installation

### From the Chrome Web Store

*Coming soon.*

### Manual Install (Developer Mode)

1. **Download the extension** — clone this repo or download the source:
   ```bash
   git clone https://github.com/yourusername/codehelper.git
   cd codehelper
   ```

2. **Build the extension:**
   ```bash
   npm install
   npm run build
   ```

3. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)
   - Click **Load unpacked**
   - Select the `dist/` folder from the build output

4. **Navigate to any supported site** — the extension activates automatically.

## Usage

### Changing Themes

Click the CodeHelper icon in the toolbar and select a theme from the dropdown. For more detailed settings, right-click the icon and select **Options**.

### Using Snippets

Type a snippet prefix and press **Tab** to expand. For example:
- In Python: type `if` + `Tab` → expands to `if condition:\n    pass`
- In C++: type `for` + `Tab` → expands to `for (int i = 0; i < n; i++) { ... }`
- Type `bfs` + `Tab` → expands to a full BFS template

Snippets also appear in the autocomplete dropdown on LeetCode (Monaco). Select one with Enter/click to insert the full snippet body, then press Tab to jump between placeholder positions.

### Keyboard Shortcuts

All shortcuts are enabled by default. Go to **Options** → **Shortcuts** to view the full list. Shortcuts cannot be remapped yet (coming in a future release).

## Configuration

Open the settings page by right-clicking the CodeHelper icon and selecting **Options**, or navigating to `chrome-extension://<id>/src/ui/options/options.html`.

You can configure:
- **Theme** — choose from 16 themes
- **Font** — family, size, line height, letter spacing, ligatures
- **Snippets** — enable/disable, add custom snippets
- **Auto-Close** — toggle, configure bracket pairs
- **Line Highlight** — toggle, color, opacity
- **Bracket Pairs** — toggle rainbow brackets
- **Indent Guides** — toggle, color
- **Cursor** — toggle, width, color, blink style
- **Selection** — toggle, background/foreground colors
- **Shortcuts** — toggle all on/off
- **Per-Site Toggles** — enable/disable on individual sites

## Building from Source

```bash
# Install dependencies
npm install

# Development (with HMR for the extension)
npm run dev

# Production build
npm run build

# TypeScript type check
npm run typecheck

# Run tests
npm test

# Package for distribution
npm run zip
```

The build uses [Vite](https://vitejs.dev/) with [CRXJS](https://crxjs.dev/) for Vite plugin to handle the Chrome Extension manifest and build pipeline.

## Architecture

```
src/
├── adapters/        # Editor adapters (Monaco, Ace, CodeMirror)
├── background/      # Service worker (settings persistence)
├── content/         # Content scripts (ISOLATED + MAIN worlds)
│   ├── main-world/  # Per-site MAIN world scripts
│   ├── base.ts      # ISOLATED world — settings bridge
│   └── main.ts      # MAIN world — feature orchestration
├── core/            # Shared utilities (bridge, storage)
├── features/        # Feature engines
│   ├── auto-close/  # Bracket/quote auto-close
│   ├── bracket-pairs/  # Rainbow brackets
│   ├── cursor/      # Cursor customization
│   ├── fonts/       # Font configuration
│   ├── indent-guides/  # Indentation guides
│   ├── indentation/ # Smart indentation
│   ├── line-highlight/ # Current line highlight
│   ├── selection/   # Selection styling
│   ├── shortcuts/   # Keyboard shortcuts
│   ├── snippets/    # Code snippets (engine + 150+ builtins)
│   └── themes/      # Theme engine (16 themes)
├── types/           # TypeScript type definitions
└── ui/              # Extension UI
    ├── components/  # Reusable UI components
    ├── options/     # Settings page
    ├── popup/       # Popup (theme switcher)
    ├── sections/    # Settings sections
    └── shared/      # Shared styles and utilities
```

### Key Design Decisions

- **Dual-world architecture**: ISOLATED world for `chrome.storage` access, MAIN world for editor DOM/API access
- **Editor adapters**: Unified `EditorAdapter` interface abstracts Monaco, Ace, and CodeMirror
- **Static imports**: All content scripts use static imports to avoid Vite chunk 404s on SPA route changes
- **Own snippet parser**: Custom snippet engine avoids Monaco 0.55.3's broken snippet pipeline
- **Ordered feature application**: Snippet engine registers before indentation to prioritize Tab expansion

## License

MIT
