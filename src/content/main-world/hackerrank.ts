// MAIN world script for HackerRank
import { onMessage, sendToIsolated } from '../../core/bridge';

function init() {
  onMessage(async (type, payload, respond) => {
    if (type === 'EDITOR_READY') {
      respond?.({ ready: true, editorType: 'ace' });
    }
  });

  sendToIsolated('EDITOR_READY', { site: 'hackerrank', editorType: 'ace' });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
