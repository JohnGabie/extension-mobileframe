const PANEL_PATH = 'sidepanel/panel.html';

// The side panel is a normal global panel opened by Chrome on the toolbar click
// (openPanelOnActionClick). This is the only gesture-safe way to open it reliably —
// calling sidePanel.open() ourselves after any await loses the user gesture and fails.
// "Locking" the mirror to a single tab is done entirely in the panel: it binds to the
// tab it opened on, ignores messages from other tabs, and shows a "locked to another
// tab" overlay when you switch away. See sidepanel/panel.js.
async function enablePanelEverywhere() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  // Clear any stale per-tab enabled:false overrides left by older builds, so the
  // panel is openable on every tab.
  try {
    await chrome.sidePanel.setOptions({ path: PANEL_PATH, enabled: true }); // global default
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id == null) continue;
      try { await chrome.sidePanel.setOptions({ tabId: t.id, path: PANEL_PATH, enabled: true }); } catch (_) {}
    }
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(enablePanelEverywhere);
chrome.runtime.onStartup.addListener(enablePanelEverywhere);

// ── Force-embed header rules ──────────────────────────────────────────
// To embed sites that set X-Frame-Options / CSP frame-ancestors, we strip those
// response headers — but ONLY for sub_frame requests (the mirror iframe; top-level
// navigation is never touched) and ONLY while the panel is open AND the user's
// "force embed" preference is on. Scoping to the panel's lifetime keeps normal
// browsing unaffected whenever the tool isn't actively in use.
const HEADER_RULE_ID = 1;
let openPanels = 0;

async function isForceEmbedEnabled() {
  const { pfs_force_embed } = await chrome.storage.local.get('pfs_force_embed');
  return pfs_force_embed !== false; // default ON
}

async function enableHeaderRules() {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [HEADER_RULE_ID],
      addRules: [{
        id: HEADER_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'X-Frame-Options', operation: 'remove' },
            { header: 'Content-Security-Policy', operation: 'remove' },
          ]
        },
        condition: { resourceTypes: ['sub_frame'] }
      }]
    });
  } catch (_) {}
}

async function disableHeaderRules() {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [HEADER_RULE_ID] });
  } catch (_) {}
}

// Enable the rules iff a panel is open and the preference is on; otherwise remove them.
async function refreshHeaderRules() {
  if (openPanels > 0 && await isForceEmbedEnabled()) {
    await enableHeaderRules();
  } else {
    await disableHeaderRules();
  }
}

// Start clean: session rules survive SW restarts, so drop any stale rule on wake.
// Open panels re-enable via their port connection below.
disableHeaderRules();

// The panel holds a long-lived port while open, so we can scope the header rules
// to exactly the time the mirror is on screen.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'pfs_panel') return;
  openPanels++;
  refreshHeaderRules();
  port.onDisconnect.addListener(() => {
    openPanels = Math.max(0, openPanels - 1);
    refreshHeaderRules();
  });
});

async function getTarget() {
  const { pfs_target } = await chrome.storage.session.get('pfs_target');
  return pfs_target ?? null;
}

// ── Messages ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  // Panel-origin messages (no sender.tab — the panel is an extension page)
  if (!sender.tab) {
    if (msg.type === 'pfs_bind') {
      chrome.storage.session.set({ pfs_target: msg.tabId });
    } else if (msg.type === 'pfs_set_force_embed') {
      chrome.storage.local.set({ pfs_force_embed: msg.enabled });
      refreshHeaderRules();
    }
    return;
  }

  // Content-script relay (scroll / media) — tag with the source tab id so the
  // panel can ignore events from tabs other than the one it is locked to.
  if (msg.type === 'pfs_scroll' || msg.type === 'pfs_media') {
    chrome.runtime.sendMessage({ ...msg, tabId: sender.tab.id }).catch(() => {});
  }
});

// ── Tab events (all carry tabId; the panel filters by targetTabId) ─────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active) return;

  if (changeInfo.url) {
    chrome.runtime.sendMessage({ type: 'pfs_tab_navigated', url: changeInfo.url, tabId }).catch(() => {});
  } else if (changeInfo.status === 'loading') {
    chrome.runtime.sendMessage({ type: 'pfs_tab_loading', tabId }).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    chrome.runtime.sendMessage({ type: 'pfs_tab_activated', url: tab.url, tabId }).catch(() => {});
  });
});

// Locked tab closed → tell the panel to stop and show a notice.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === await getTarget()) {
    chrome.storage.session.set({ pfs_target: null });
    chrome.runtime.sendMessage({ type: 'pfs_target_closed' }).catch(() => {});
  }
});
