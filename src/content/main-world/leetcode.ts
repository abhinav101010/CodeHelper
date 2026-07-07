// MAIN world script for LeetCode
// This runs in the page context to access Monaco Editor API

import { onMessage, sendToIsolated } from '../../core/bridge';

function init() {
  // Listen for messages from ISOLATED world
  onMessage(async (type, payload, respond) => {
    if (type === 'EDITOR_READY') {
      // Monaco is available on LeetCode
      const monaco = (window as any).monaco;
      if (monaco?.editor) {
        // Apply our custom theme to Monaco
        const settings = payload as any;

        respond?.({
          ready: true,
          editorType: 'monaco',
          monacoAvailable: true,
        });
      } else {
        respond?.({
          ready: false,
          editorType: 'monaco',
          monacoAvailable: false,
        });
      }
    }

    if (type === 'SETTINGS_UPDATE') {
      // Re-apply theme if needed
      respond?.({ applied: true });
    }
  });

  // Notify ISOLATED world that MAIN world is ready
  sendToIsolated('EDITOR_READY', {
    site: 'leetcode',
    editorType: 'monaco',
  });
}

// Initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
