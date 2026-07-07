import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    // CRITICAL: Disable Vite's module preloading for Chrome extension content scripts.
    // Vite generates <link rel="modulepreload"> tags with absolute URLs like /assets/engine-*.js
    // that resolve against the PAGE origin (e.g., https://leetcode.com), causing 404s.
    // This makes dynamic imports (import('../features/snippets/engine')) fail intermittently,
    // especially after page reload when cached preloads are stale.
    modulePreload: false,
    rollupOptions: {
      input: {
        // MAIN-world entry points for each site
        'main-world/leetcode': 'src/content/main-world/leetcode.ts',
        'main-world/codechef': 'src/content/main-world/codechef.ts',
        'main-world/codeforces': 'src/content/main-world/codeforces.ts',
        'main-world/hackerrank': 'src/content/main-world/hackerrank.ts',
        'main-world/atcoder': 'src/content/main-world/atcoder.ts',
        'main-world/geeksforgeeks': 'src/content/main-world/geeksforgeeks.ts',
        'main-world/hackerearth': 'src/content/main-world/hackerearth.ts',
      },
    },
  },
  // Keep console logs for debugging — critical for extension development
  esbuild: {
    drop: [],
  },
});
