// MAIN world script for CodeChef
// This runs in the page context to access Ace Editor API

import { onMessage, sendToIsolated } from '../../core/bridge';

function init() {
  onMessage(async (type, payload, respond) => {
    if (type === 'EDITOR_READY') {
      const ace = (window as any).ace;
      if (ace) {
        respond?.({
          ready: true,
          editorType: 'ace',
          aceAvailable: true,
        });
      } else {
        respond?.({
          ready: false,
          editorType: 'ace',
          aceAvailable: false,
        });
      }
    }
  });

  sendToIsolated('EDITOR_READY', {
    site: 'codechef',
    editorType: 'ace',
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
