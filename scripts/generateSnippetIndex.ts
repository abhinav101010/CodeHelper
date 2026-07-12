/**
 * generateSnippetIndex.ts
 *
 * Build-time script that scans src/snippets/ for all *.json files,
 * reads metadata from each snippet pack, and generates
 * src/packs/index.json automatically.
 *
 * Run:   npm run generate:snippets
 * Uses:  tsx (TypeScript executor)
 *
 * After adding a new .json file to src/snippets/:
 *   1. Define its metadata in PACK_META below.
 *   2. Add the language mapping in LANGUAGE_SNIPPET_MAP (in snippet-loader.ts).
 *   3. Import the .json statically in snippet-loader.ts (for built-in bundles).
 *   4. Run `npm run generate:snippets` to regenerate index.json.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Paths ──────────────────────────────────────────────────────────────────
// Resolve relative to this script's location (scripts/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SNIPPETS_DIR = path.resolve(PROJECT_ROOT, 'src', 'snippets');
const OUTPUT_FILE = path.resolve(PROJECT_ROOT, 'src', 'packs', 'index.json');

// ── Base URL for raw GitHub content ────────────────────────────────────────
// Change this ONE constant if the repository moves or you switch CDNs.
const REMOTE_SNIPPET_BASE =
  'https://raw.githubusercontent.com/abhinav101010/CodeHelper/main/src/snippets/';

// ── Pack metadata ──────────────────────────────────────────────────────────
// Add new languages here. The key must match the filename (without .json).
interface PackMeta {
  name: string;
  languages: string[];
  description: string;
  author: string;
  version: string;
  lastUpdated?: string;
}

const PACK_META: Record<string, PackMeta> = {
  python: {
    name: 'Python (Official VS Code)',
    languages: ['python', 'python3'],
    description:
      'Standard Python snippets from VS Code — if, for, while, class, def, and more',
    author: 'Microsoft',
    version: '1.0.0',
    lastUpdated: '2025-06-01T00:00:00.000Z',
  },
  cpp: {
    name: 'C++ (Official VS Code)',
    languages: ['cpp', 'c', 'c++'],
    description:
      'Standard C++ snippets from VS Code — for, while, if, class, namespace, and more',
    author: 'Microsoft',
    version: '1.0.0',
    lastUpdated: '2025-06-01T00:00:00.000Z',
  },
  javascript: {
    name: 'JavaScript (Official VS Code)',
    languages: ['javascript', 'js'],
    description:
      'Standard JavaScript snippets from VS Code — function, class, forEach, arrow, and more',
    author: 'Microsoft',
    version: '1.0.0',
    lastUpdated: '2025-06-01T00:00:00.000Z',
  },
  typescript: {
    name: 'TypeScript (Official VS Code)',
    languages: ['typescript', 'ts'],
    description:
      'Standard TypeScript snippets from VS Code — interface, type, enum, function, and more',
    author: 'Microsoft',
    version: '1.0.0',
    lastUpdated: '2025-06-01T00:00:00.000Z',
  },
  html: {
    name: 'HTML (Official VS Code)',
    languages: ['html'],
    description:
      'Standard HTML snippets from VS Code — !, html, head, body, div, and more',
    author: 'Microsoft',
    version: '1.0.0',
    lastUpdated: '2025-06-01T00:00:00.000Z',
  },
  css: {
    name: 'CSS (Official VS Code)',
    languages: ['css'],
    description:
      'Standard CSS snippets from VS Code — flex, grid, media, animation, and more',
    author: 'Microsoft',
    version: '1.0.0',
    lastUpdated: '2025-06-01T00:00:00.000Z',
  },
  php: {
    name: 'PHP (Official VS Code)',
    languages: ['php'],
    description:
      'Standard PHP snippets from VS Code — function, class, foreach, echo, and more',
    author: 'Microsoft',
    version: '1.0.0',
    lastUpdated: '2025-06-01T00:00:00.000Z',
  },
  swift: {
    name: 'Swift (Official VS Code)',
    languages: ['swift'],
    description:
      'Standard Swift snippets from VS Code — func, var, class, struct, enum, guard, and more',
    author: 'Microsoft',
    version: '1.0.0',
    lastUpdated: '2025-06-01T00:00:00.000Z',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function validateSnippetFile(filePath: string): boolean {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      console.warn(`  ⚠  Skipping ${path.basename(filePath)}: not a valid object`);
      return false;
    }
    const entries = Object.keys(parsed);
    if (entries.length === 0) {
      console.warn(`  ⚠  Skipping ${path.basename(filePath)}: contains no snippet entries`);
      return false;
    }
    // Check that each entry has at least a body
    for (const [name, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') {
        console.warn(`  ⚠  Entry "${name}" in ${path.basename(filePath)} is invalid, skipping file`);
        return false;
      }
      const e = entry as Record<string, unknown>;
      if (!e.body) {
        console.warn(`  ⚠  Entry "${name}" in ${path.basename(filePath)} has no body, skipping file`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn(`  ⚠  Skipping ${path.basename(filePath)}: ${(err as Error).message}`);
    return false;
  }
}

function autoGenerateDescription(meta: PackMeta, filePath: string): string {
  // If a description is already defined, use it
  if (meta.description) return meta.description;

  // Otherwise, generate from the first few snippet prefixes in the file
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const prefixes: string[] = [];
    for (const entry of Object.values(parsed)) {
      const e = entry as Record<string, unknown>;
      if (e.prefix) {
        if (Array.isArray(e.prefix)) {
          prefixes.push(...(e.prefix as string[]).filter((p): p is string => typeof p === 'string'));
        } else if (typeof e.prefix === 'string') {
          prefixes.push(e.prefix);
        }
      }
    }
    if (prefixes.length > 0) {
      const sample = prefixes.slice(0, 8).join(', ');
      const lang = meta.languages[0] ?? path.basename(filePath, '.json');
      return `Snippets for ${lang} — ${sample}, and more`;
    }
  } catch {
    // fall through
  }

  return `Snippets for ${meta.languages[0] ?? path.basename(filePath, '.json')}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  console.log('🔍 Scanning snippet files in:', SNIPPETS_DIR);

  // Discover all *.json files
  let files: string[];
  try {
    files = fs.readdirSync(SNIPPETS_DIR).filter((f) => f.endsWith('.json'));
  } catch (err) {
    console.error('❌ Failed to read snippets directory:', (err as Error).message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.warn('⚠  No snippet files found.');
    process.exit(0);
  }

  console.log(`   Found ${files.length} snippet file(s): ${files.join(', ')}\n`);

  const packs: any[] = [];

  for (const file of files) {
    const filePath = path.join(SNIPPETS_DIR, file);
    const basename = path.basename(file, '.json');
    const meta = PACK_META[basename];

    if (!meta) {
      console.warn(
        `  ⚠  No metadata defined for "${basename}" in PACK_META. Skipping.`,
      );
      continue;
    }

    // Validate snippet file
    if (!validateSnippetFile(filePath)) {
      continue;
    }

    const desc = autoGenerateDescription(meta, filePath);
    const packId =
      basename === 'php' ? 'php' : `${basename}-official`;

    packs.push({
      id: packId,
      name: meta.name,
      description: desc,
      author: meta.author,
      version: meta.version,
      languages: meta.languages,
      url: `${REMOTE_SNIPPET_BASE}${file}`,
      installed: true,
      enabled: true,
      lastUpdated: meta.lastUpdated ?? new Date().toISOString(),
    });

    console.log(`  ✓ ${file} → ${packId}`);
  }

  // Sort: by primary language, then by name
  packs.sort((a, b) => {
    const langA = (a.languages[0] ?? '').toLowerCase();
    const langB = (b.languages[0] ?? '').toLowerCase();
    if (langA !== langB) return langA.localeCompare(langB);
    return a.name.localeCompare(b.name);
  });

  // Generate the index
  const index = {
    version: 1,
    packs,
  };

  // Write output
  try {
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2) + '\n', 'utf-8');
    console.log(`\n✅ Generated ${OUTPUT_FILE} with ${packs.length} pack(s).`);
  } catch (err) {
    console.error('❌ Failed to write index file:', (err as Error).message);
    process.exit(1);
  }
}

main();
