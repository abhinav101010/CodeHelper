# CodeHelper — Code Assistance Chrome Extension

CodeHelper supercharges online coding platforms (LeetCode, CodeChef, Codeforces, HackerRank, AtCoder, GeeksforGeeks, HackerEarth) with VS Code–style snippet expansion, tab-stop placeholders, local identifier autocomplete, and visual editor enhancements.

## Features

### Snippet Expansion with Tab-Stop Placeholders

Type a trigger word and press **Tab** to expand it into a code block. Navigate through placeholders with **Tab** / **Shift+Tab**, just like VS Code.

```
if  →  if condition:
           pass

for →  for i in range(n):
           pass

def →  def function_name(args):
           """docstring"""
           pass
```

- **Mirrored placeholders**: editing one placeholder updates all mirrors with the same index.
- **$0 final cursor position**: pressing Tab past the last placeholder exits snippet mode.
- **Active placeholder highlighting**: the current placeholder is visually distinct.
- **Escape** or clicking outside gracefully exits snippet mode.

### VS Code Snippet File Support

Load official VS Code snippet JSON files directly. Drop any `.json` file (from the VS Code marketplace or your own collection) and it works instantly:

```json
{
  "For Loop": {
    "prefix": "for",
    "body": [
      "for (${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {",
      "\t${0}",
      "}"
    ],
    "description": "For loop"
  }
}
```

Supported syntax:
- `$1`, `${1}`, `${1:default}`, `${1|choice1,choice2|}`
- Nested placeholders
- Mirrored placeholders (`${1}` appearing multiple times)
- Variables: `$TM_FILENAME`, `$CURRENT_YEAR`, etc.
- Escaped characters: `\$`, `\\`, `\}`

### Built-in Snippet Packs

Pre-bundled snippet packs for:
| Language | Pack |
|---|---|
| Python | python-official |
| C++ | cpp-official |
| JavaScript | javascript-official |
| TypeScript | typescript-official |
| Java | java-official |
| HTML | html-official |
| CSS | css-official |
| PHP | php-official |

### Snippet Gallery (Settings)

Browse, install, and uninstall snippet packs from the Settings page. Installed packs are cached in extension storage and work offline.

### Pack Update Notifications

When a newer version of an installed pack is available on GitHub, the Settings page shows a **Pack Updates Available** section with version diffing:
- Lists each updatable pack with version numbers (old → new)
- **View Changes** expands an inline diff summary (added, removed, modified snippets)
- **Update** button downloads and replaces the pack in one click
- **Dismiss** hides the notification for the current session
- **Update All** bulk-updates all packs at once
- Tracks installed version vs. remote version using semantic versioning and timestamps

### Document Symbol Index (Local Autocomplete)

No AI, no API calls, no network requests. A unified Document Symbol Index similar to VS Code's IntelliSense indexes every identifier in the editor:

- Classes, structs, interfaces, enums, namespaces
- Functions, methods, constructors
- Parameters (including lambda/arrow function params)
- Local variables, loop variables, catch variables
- Fields, static fields, properties
- Constants (UPPER_CASE)
- Imports

Ranking: exact prefix match > scope proximity > symbol kind priority > declaration distance > usage frequency > alphabetical.

Supported languages:
- Python
- C, C++
- Java
- JavaScript
- TypeScript
- PHP
- CSS
- HTML

Scope-aware: suggests symbols from the current scope first, then outer scopes. Never suggests variables not yet in scope.

### Visual Enhancements

- **Editor themes**: apply VS Code–style themes to Monaco and Ace editors
- **Custom fonts**: JetBrains Mono, Fira Code, etc.
- **Line highlighting**: current line background color
- **Bracket pair colorization**: matching bracket colors
- **Indent guides**: vertical rulers at each indent level
- **Cursor styling**: custom width, color, and blink style
- **Selection styling**: custom background and foreground colors

## Installation

1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Load the `dist/` directory as an unpacked extension in Chrome (`chrome://extensions`)

## Development

```bash
npm install
npm run dev          # Watch mode with hot reload
npm run build        # Production build
npm run generate:snippets   # Regenerate snippet index from src/snippets/
npm run tsc          # Type check only
```

### Adding New Snippet Packs

1. Create a VS Code–format snippet JSON file in `src/snippets/`
2. Import it in `src/snippet-loader.ts`
3. Run `npm run generate:snippets`
4. Rebuild with `npm run build`

The snippet index is generated automatically — no manual `index.json` editing needed.

## Architecture

```
src/
├── adapters/              # Editor adapters (Monaco, Ace, CodeMirror)
├── content/
│   ├── main.ts            # MAIN world content script
│   └── base.ts            # ISOLATED world content script
├── features/
│   ├── snippets/          # Snippet engine, parser, widget, template resolver
│   ├── autocomplete/      # Local identifier index (deprecated — see core/symbols/)
│   ├── themes/            # Theme engine
│   ├── fonts/             # Font engine
│   ├── line-highlight/    # Line highlight
│   ├── bracket-pairs/     # Bracket pair colorization
│   ├── indent-guides/     # Indent guides
│   ├── cursor/            # Cursor styling
│   ├── selection/         # Selection styling
│   ├── auto-close/        # Auto-close brackets/quotes
│   ├── indentation/       # Smart indentation
│   └── shortcuts/         # Custom keyboard shortcuts
├── packs/                 # Generated snippet pack index
├── snippets/              # VS Code snippet JSON files
├── core/
│   ├── symbols/           # Document Symbol Index (extractors, store, ranker, collector)
│   │   ├── DocumentSymbol.ts
│   │   ├── DocumentSymbolIndexer.ts
│   │   ├── DocumentSymbolStore.ts
│   │   ├── ScopeResolver.ts
│   │   ├── SuggestionRanker.ts
│   │   ├── SymbolCollector.ts
│   │   └── LanguageExtractors/
│   │       ├── python.ts, cpp.ts, java.ts, javascript.ts
│   │       ├── typescript.ts, php.ts, css.ts, html.ts
│   │       └── index.ts
│   ├── bridge.ts          # ISOLATED↔MAIN communication
├── types/                 # TypeScript type definitions
└── ui/                    # Settings, popup pages
```

### Snippet Engine

The snippet engine uses a state machine with three states:

```
IDLE → EXPANDING → SESSION → IDLE
```

1. **IDLE**: user types normally, widget shows snippet suggestions
2. **EXPANDING**: user presses Tab, snippet is being inserted
3. **SESSION**: snippet placeholders are active, Tab navigates between them

Tab-stop positions are tracked using Monaco's decoration/tracked-range API (`deltaDecorations`) to handle document edits without stale offsets.

## Configuration

Open the extension popup or navigate to the Settings page to configure:
- Enable/disable per-site
- Install/uninstall snippet packs
- Toggle individual features
- Customize colors, fonts, and keyboard shortcuts

## Supported Sites

- LeetCode
- CodeChef
- Codeforces
- HackerRank
- AtCoder
- GeeksforGeeks
- HackerEarth

## License

MIT
