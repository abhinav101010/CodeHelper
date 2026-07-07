// Service worker for CodeHelper extension

chrome.runtime.onInstalled.addListener(() => {
  // Set badge
  chrome.action.setBadgeText({ text: 'CH' });
  chrome.action.setBadgeBackgroundColor({ color: '#007acc' });

  // Initialize default settings
  chrome.storage.sync.get('settings', (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({
        settings: {
          enabled: true,
          perSite: {
            leetcode: true,
            codechef: true,
            codeforces: true,
            hackerrank: true,
            atcoder: true,
            geeksforgeeks: true,
            hackerearth: true,
          },
          theme: { name: 'vscode-dark' },
          font: {
            family: 'JetBrains Mono',
            size: 14,
            lineHeight: 1.5,
            letterSpacing: 0,
            ligatures: true,
          },
          features: {
            snippets: { enabled: true, customSnippets: [] },
            autoClose: {
              enabled: true,
              pairs: {
                '(': ')',
                '[': ']',
                '{': '}',
                '"': '"',
                "'": "'",
                '`': '`',
              },
            },
            indentation: { enabled: true },
            lineHighlight: { enabled: true, color: '#2a2d2e', opacity: 0.5 },
            bracketPairs: { enabled: true },
            indentGuides: { enabled: true, color: '#404040' },
            cursor: {
              enabled: true,
              width: 2,
              color: '#aeafad',
              blinkStyle: 'smooth',
            },
            selection: {
              enabled: true,
              backgroundColor: '#264f78',
              foregroundColor: '#ffffff',
            },
            shortcuts: { enabled: true, mappings: {} },
          },
        },
      });
    }
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get('settings', (result) => {
      sendResponse(result.settings);
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.sync.set({ settings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
