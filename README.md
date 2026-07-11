# CodeHelper — VS Code–style Editor Enhancement for Coding Platforms

CodeHelper is a Chrome extension that brings VS Code–quality editing, snippets, and autocomplete to competitive coding and interview preparation platforms like LeetCode, CodeChef, Codeforces, HackerRank, AtCoder, GeeksforGeeks, and HackerEarth.

## Features

### 🧩 VS Code–Style Snippets

Expand common code structures instantly with Tab:

- **Python**: `if`, `for`, `while`, `def`, `class`, `import`, `try`, `with`
- **C++**: `for`, `while`, `if`, `class`, `struct`, `namespace`, `#include`
- **JavaScript**: `function`, `arrow`, `class`, `forEach`, `map`, `filter`
- **TypeScript**: `interface`, `type`, `enum`, `async`, `arrow`
- **HTML**: `!` (emmet-style), `html`, `head`, `div`, `form`, `input`
- **CSS**: `flex`, `grid`, `media`, `animation`, `keyframes`

Snippet features:

- Tab stop navigation — press Tab to jump between placeholders
- Shift+Tab to go backward
- Mirrored placeholders — edit one, all mirrors update
- Default values — `${1:condition}` pre-fills text
- Final position — `$0` is the last cursor position
- Active placeholder highlighting
- Graceful exit on Escape or click outside

> Snippets are loaded from official VS Code snippet files and parsed directly — no manual conversion needed.

### 🔍 Local Identifier Autocomplete

Parse the current editor content and suggest local variables, functions, classes, and parameters as you type — all offline, no AI, no API calls.

- Language-aware parsing for Python, C++, Java, JavaScript, TypeScript, and more
- Scope-priority sorting (local → function → global)
- Works seamlessly with snippet suggestions
- Updates in real time as you type

### 🎨 Editor Enhancements

- **Themes**: 16+ premium themes (VS Code Dark, GitHub Dark, Monokai, Dracula, Tokyo Night, Nord, and more)
- **Fonts**: JetBrains Mono, Fira Code, Cascadia Code, and any system font with ligatures
- **Line Highlight**: Customizable active line color and opacity
- **Bracket Pair Colorization**: Rainbow-colored bracket pairs
- **Indent Guides**: Vertical indentation guides
- **Cursor Styles**: Customizable width, color, and blink animation
- **Selection Styling**: Custom foreground and background colors
- **Auto-Close Pairs**: Smart bracket and quote closing
- **Smart Indentation**: Automatic indentation on Enter

### ⌨️ Keyboard Shortcuts

12 built-in shortcuts for common actions, with customizable key mappings.

## Installation

### Chrome Web Store

> Coming soon

### Manual Installation (Developer Mode)

1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome → `chrome://extensions`
5. Enable **Developer mode** (toggle in top-right)
6. Click **Load unpacked** and select the `dist/` directory

## Usage

1. Navigate to a supported coding platform (LeetCode, CodeChef, etc.)
2. Open any code editor
3. Start typing a snippet prefix (e.g., `if` in Python)
4. Press **Tab** to expand the snippet
5. Use **Tab** / **Shift+Tab** to navigate between placeholders
6. Type inside placeholders to fill them in
7. Press **Escape** or click outside to exit snippet mode

### Snippet Gallery (Settings → Snippets)

Browse, install, and manage snippet packs from the Settings page:

- **Python (Official VS Code)** ✓ Built-in
- **C++ (Official VS Code)** ✓ Built-in
- **JavaScript (Official VS Code)** ✓ Built-in
- **TypeScript (Official VS Code)** ✓ Built-in
- **HTML (Official VS Code)** ✓ Built-in
- **CSS (Official VS Code)** ✓ Built-in

Enable/disable packs without uninstalling. Changes take effect immediately.

## Supported Platforms

| Platform | Status |
|---|---|
| [LeetCode](https://leetcode.com) | ✅ Full support |
| [CodeChef](https://www.codechef.com) | ✅ Full support |
| [Codeforces](https://codeforces.com) | ✅ Full support |
| [HackerRank](https://www.hackerrank.com) | ✅ Full support |
| [AtCoder](https://atcoder.jp) | ✅ Full support |
| [GeeksforGeeks](https://www.geeksforgeeks.org) | ✅ Full support |
| [HackerEarth](https://www.hackerearth.com) | ✅ Full support |

## Project Structure

```
src/
  adapters/          Editor adapters (Monaco, CodeMirror, ACE)
  background/        Service worker
  content/           Content scripts (ISOLATED + MAIN worlds)
  core/              Shared utilities (bridge, settings, language detection)
  features/
    auto-close/      Auto-close brackets and quotes
    autocomplete/    Local identifier autocomplete
    cursor/          Custom cursor styles
    fonts/           Custom font loading
    indentation/     Smart indentation
    line-highlight/  Active line highlighting
    selection/       Selection styling
    shortcuts/       Keyboard shortcuts
    snippets/        Snippet engine, parser, widget, pack manager
    themes/          Premium color themes
  packs/             Bundled snippet pack metadata
  snippets/          Official VS Code snippet JSON files
  types/             TypeScript type definitions
  ui/
    options/         Options/settings page
    popup/           Extension popup
```

## Development

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

## Architecture

CodeHelper uses a two-world content script architecture:

- **ISOLATED world** (`base.ts`): Manages `chrome.storage.sync` settings, handles extension context invalidation, and forwards settings to the MAIN world via `window.postMessage`
- **MAIN world** (`main.ts`): Interacts with the page's Monaco/CodeMirror/ACE editor instances, applies themes, fonts, and all editor enhancements

Communication between worlds uses a bridge system with retry logic and exponential backoff.

### Snippet Engine

The snippet engine (in `src/features/snippets/engine.ts`) implements:

1. **Capture-phase keydown handler** for Tab, Enter, Escape, and Arrow keys
2. **Custom suggestion widget** that overlays above the editor (avoids Monaco 0.55.3 broken `CompletionItemProvider`)
3. **Decoration-based placeholder tracking** using Monaco's tracked ranges (avoids brittle fixed offsets)
4. **Mirrored placeholders** — edits to one placeholder sync to all mirrors with the same index
5. **Single centralized update function** (`performUpdate`) that eliminates race conditions between content changes, cursor moves, and snippet state

## License

MIT
