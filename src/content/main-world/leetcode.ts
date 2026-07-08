// MAIN world script for LeetCode (legacy entry point)
// All features are handled by src/content/main.ts which is injected
// as the primary MAIN-world content script.
// This file exists only as a vite entry point and does nothing
// that conflicts with main.ts.

import { sendToIsolated } from '../../core/bridge';

function init() {
  // Silently signal readiness. The ISOLATED world may or may not
  // handle this — main.ts handles all feature logic.
  sendToIsolated('EDITOR_READY', {
    site: 'leetcode',
    editorType: 'monaco',
  }).catch(() => {
    // ISOLATED might not handle EDITOR_READY; that's fine.
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
