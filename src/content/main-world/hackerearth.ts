// MAIN world script for HackerEarth
import { onMessage, sendToIsolated } from '../../core/bridge';

function init() {
  onMessage(async (type, payload, respond) => {
    if (type === 'EDITOR_READY') {
      respond?.({ ready: true, editorType: 'codemirror' });
    }
  });

  sendToIsolated('EDITOR_READY', { site: 'hackerearth', editorType: 'codemirror' });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
