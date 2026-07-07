chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Remove iframe-blocking headers for sub_frame requests only.
// Main tab headers are untouched — only affects our mirror iframe.
// Session rules are re-added every time the service worker starts.
chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [1],
  addRules: [{
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        { header: 'X-Frame-Options', operation: 'remove' },
        { header: 'Content-Security-Policy', operation: 'remove' },
      ]
    },
    condition: {
      resourceTypes: ['sub_frame']
    }
  }]
});

// Relay scroll events from content scripts to the side panel
chrome.runtime.onMessage.addListener((msg, sender) => {
  // sender.tab is set only for content scripts — prevents relay loop
  if (!sender.tab) return;

  if (msg.type === 'pfs_scroll' || msg.type === 'pfs_media') {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});

// Relay tab URL changes and reloads to the side panel
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active) return;

  if (changeInfo.url) {
    chrome.runtime.sendMessage({ type: 'pfs_tab_navigated', url: changeInfo.url }).catch(() => {});
  } else if (changeInfo.status === 'loading') {
    chrome.runtime.sendMessage({ type: 'pfs_tab_loading' }).catch(() => {});
  }
});

// Notify panel when the user switches to a different tab
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    chrome.runtime.sendMessage({ type: 'pfs_tab_activated', url: tab.url }).catch(() => {});
  });
});
