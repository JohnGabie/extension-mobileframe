const PANEL_PATH = 'sidepanel/panel.html';

// ── Panel scope ───────────────────────────────────────────────────────
// 'single' (default): a *contextual* side panel — it exists only on the tab where
//   the user opened it and is completely hidden on every other tab (as if never
//   opened there). Implemented with per-tab sidePanel.setOptions + sidePanel.open.
// 'all': a global side panel available on every tab (legacy "follow active tab").
async function getMode() {
  const { pfs_mode } = await chrome.storage.local.get('pfs_mode');
  return pfs_mode === 'all' ? 'all' : 'single';
}

// Configure panel visibility for the given mode. In single mode the panel is enabled
// only on `focusTabId` (and the global default is off, so new tabs stay hidden).
// Setting options for non-active tabs does not recreate the open panel, so there is
// no flicker when this runs.
async function applyMode(mode, focusTabId) {
  // Global default: shown everywhere in 'all', hidden everywhere in 'single'.
  try { await chrome.sidePanel.setOptions({ path: PANEL_PATH, enabled: mode === 'all' }); } catch (_) {}

  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id == null) continue;
    const on = mode === 'all' || t.id === focusTabId;
    try { await chrome.sidePanel.setOptions({ tabId: t.id, path: PANEL_PATH, enabled: on }); } catch (_) {}
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // We open the panel ourselves per tab, so don't let the action toggle a global one.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  await applyMode(await getMode(), null); // no target yet → single: hidden everywhere
});

chrome.runtime.onStartup.addListener(async () => {
  await applyMode(await getMode(), null);
});

// Clicking the toolbar icon opens the panel bound to that specific tab.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  const mode = await getMode();
  await applyMode(mode, tab.id);
  if (mode === 'single') await chrome.storage.session.set({ pfs_target: tab.id });
  try { await chrome.sidePanel.open({ tabId: tab.id }); } catch (_) {}
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
    } else if (msg.type === 'pfs_set_mode') {
      chrome.storage.local.set({ pfs_mode: msg.mode });
      applyMode(msg.mode, msg.tabId);
      if (msg.mode === 'single' && msg.tabId != null) {
        chrome.storage.session.set({ pfs_target: msg.tabId });
      }
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
