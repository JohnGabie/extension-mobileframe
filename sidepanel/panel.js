const BASE = chrome.runtime.getURL('assets/');

const phoneFrame    = document.getElementById('phone-frame');
const frameArt      = document.getElementById('frame-art');
const screenCutout  = document.getElementById('screen-cutout');
const mirror        = document.getElementById('mirror');
const deviceSelect  = document.getElementById('device-select');
const statusEl      = document.getElementById('status');
const blockedNotice = document.getElementById('blocked-notice');
const deviceLabel   = document.getElementById('device-label');
const settingsBtn   = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const toggleAllTabs = document.getElementById('toggle-all-tabs');
const toggleForceEmbed = document.getElementById('toggle-force-embed');
const pausedOverlay = document.getElementById('paused-overlay');
const statusBarEl   = document.getElementById('status-bar-overlay');
const homeIndicator = document.getElementById('home-indicator');

const browserSelect   = document.getElementById('browser-select');
const browserToggles  = document.getElementById('browser-toggles');
const brTop           = document.getElementById('br-top');
const brBottom        = document.getElementById('br-bottom');
const brSafariTop     = document.getElementById('br-safari-top');
const brChromeTop     = document.getElementById('br-chrome-top');
const brSafariUrl     = document.getElementById('br-safari-url');
const brChromeUrl     = document.getElementById('br-chrome-url');
const toggleBrTop     = document.getElementById('toggle-br-top');
const toggleBrBottom  = document.getElementById('toggle-br-bottom');
const safariIcons     = document.querySelectorAll('.br-safari-icon');
const chromeIcons     = document.querySelectorAll('.br-chrome-icon');

let config = {};       // full frame-config.json
let currentDevice = 'iphone-13';
let currentUrl = '';
let isBlocked = false;
let _mirrorReady = false;

// Tab-lock: in 'single' mode the mirror is locked to targetTabId and ignores every
// other tab; 'all' mode follows whichever tab is active (legacy behavior).
let mode = 'single';       // persisted in chrome.storage.local
let targetTabId = null;    // the locked tab (set on boot from the active tab)
let activeTabId = null;    // the tab currently focused in the browser

// True when an incoming tab-scoped message belongs to the tab we should sync with.
function isSyncTab(tabId) {
  return mode === 'all' || tabId == null || tabId === targetTabId;
}

// In single mode, when the user is looking at a different tab, show a "locked to
// another tab" overlay instead of syncing/following it.
function updateLockState() {
  const paused = mode === 'single' && targetTabId != null &&
                 activeTabId != null && activeTabId !== targetTabId;
  if (pausedOverlay) pausedOverlay.classList.toggle('visible', paused);
}

// Navigation sync is bidirectional (desktop↔mobile). Every programmatic sync of one
// side triggers a navigation event on the other side as an echo (plus redirects and
// multiple onUpdated events). We swallow that echo with a short time window per
// direction instead of matching exact URLs — which broke on normalization/redirects.
const SYNC_WINDOW = 1500;   // ms — covers redirects + multiple onUpdated events
let suppressTabSync = 0;    // ignore tab→mirror events until this timestamp
let suppressMirrorSync = 0; // ignore mirror→tab events until this timestamp

function sameUrl(a, b) {
  try { return new URL(a).href === new URL(b).href; }
  catch { return a === b; }
}

// Hold a long-lived port so the background can scope the force-embed header rules to
// exactly the time the panel is open. Reconnect if the service worker recycles it.
function connectPanelPort() {
  const port = chrome.runtime.connect({ name: 'pfs_panel' });
  port.onDisconnect.addListener(() => setTimeout(connectPanelPort, 100));
}
connectPanelPort();

// ── Load config and boot ──────────────────────────────────────────────
chrome.storage.local.get(['pfs_mode', 'pfs_force_embed'], ({ pfs_mode, pfs_force_embed }) => {
  mode = pfs_mode === 'all' ? 'all' : 'single';
  if (toggleAllTabs) toggleAllTabs.checked = (mode === 'all');
  if (toggleForceEmbed) toggleForceEmbed.checked = (pfs_force_embed !== false); // default ON

  fetch(BASE + 'frame-config.json')
    .then(r => r.json())
    .then(data => {
      config = data;
      applyDevice(currentDevice);
      getActiveTabUrl();
    });
});

// Bind (or re-bind) the mirror to the currently active tab.
function getActiveTabUrl() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    targetTabId = tabs[0].id;
    activeTabId = tabs[0].id;
    chrome.runtime.sendMessage({ type: 'pfs_bind', tabId: targetTabId });
    updateLockState();
    if (tabs[0].url) navigateTo(tabs[0].url);
  });
}

// ── Device switching ──────────────────────────────────────────────────
deviceSelect.addEventListener('change', () => {
  currentDevice = deviceSelect.value;
  applyDevice(currentDevice);
});

let _currentDev = null;

function applyDevice(key) {
  const dev = config[key];
  if (!dev) return;
  _currentDev = dev;

  const { imageWidth, imageHeight, screen: s } = dev;

  frameArt.src = BASE + dev.image;
  phoneFrame.style.setProperty('--phone-ar', `${imageWidth} / ${imageHeight}`);
  phoneFrame.style.setProperty('--phone-ratio', (imageWidth / imageHeight).toFixed(6));
  deviceLabel.textContent = dev.label;

  const leftPct   = (s.x / imageWidth  * 100).toFixed(4) + '%';
  const topPct    = (s.y / imageHeight * 100).toFixed(4) + '%';
  const widthPct  = (s.width  / imageWidth  * 100).toFixed(4) + '%';
  const heightPct = (s.height / imageHeight * 100).toFixed(4) + '%';

  screenCutout.style.left   = leftPct;
  screenCutout.style.top    = topPct;
  screenCutout.style.width  = widthPct;
  screenCutout.style.height = heightPct;

  applyBorderRadius();
  requestAnimationFrame(applyIframeScale);
}

function applyBorderRadius() {
  if (!_currentDev) return;
  const { imageWidth, borderRadius } = _currentDev;
  const displayWidth = phoneFrame.getBoundingClientRect().width || phoneFrame.offsetWidth || 320;
  const scale = displayWidth / imageWidth;
  screenCutout.style.borderRadius = Math.round(borderRadius * scale) + 'px';
}

// Render the iframe at the device's native CSS resolution then scale to fit the cutout.
// This ensures sites see the correct viewport width (e.g. 390px for iPhone 13)
// instead of the small physical pixel size of the frame in the panel.
function resolvePct(cs, name, base) {
  const raw = cs.getPropertyValue(name).trim(); // e.g. "5.2%" or "0%"
  const n = parseFloat(raw) || 0;
  return raw.endsWith('%') ? n / 100 * base : n;
}

function applyIframeScale() {
  const dev = _currentDev;
  if (!dev?.cssWidth) return;
  const cw = screenCutout.offsetWidth;
  const ch = screenCutout.offsetHeight;
  if (!cw || !ch) return;

  // Inset the mirror below the status bar + address bar and above the bottom bar,
  // so the fake iOS chrome never covers the site's own content (Safari behavior).
  const cs = getComputedStyle(screenCutout);
  const topInset = resolvePct(cs, '--sb-h', ch) + resolvePct(cs, '--bb-top-h', ch);
  const botInset = resolvePct(cs, '--bb-bot-h', ch);
  const availH = Math.max(0, ch - topInset - botInset);

  const scale = cw / dev.cssWidth;
  mirror.style.top       = topInset + 'px';
  mirror.style.width     = dev.cssWidth + 'px';
  mirror.style.height    = Math.ceil(availH / scale) + 'px';
  mirror.style.transform = `scale(${scale})`;
}

new ResizeObserver(() => { applyBorderRadius(); applyIframeScale(); }).observe(phoneFrame);

// Prefixes que o Chrome não deixa embutir em iframe
const BLOCKED_PREFIXES = [
  'chrome://', 'chrome-extension://', 'chrome-search://',
  'devtools://', 'about:', 'file://', 'view-source://',
];

// ── iframe navigation ─────────────────────────────────────────────────
function navigateTo(url) {
  if (!url || BLOCKED_PREFIXES.some(p => url.startsWith(p))) {
    showBlocked('Esta página não pode ser embutida.');
    return;
  }
  _mirrorReady = false;
  clearBlocked();
  currentUrl = url;
  suppressMirrorSync = Date.now() + SYNC_WINDOW; // the mirror's own load echo is ours
  mirror.src = url;
  updateBrowserUrl(url);
}

function reloadMirror() {
  if (!currentUrl) return;
  suppressMirrorSync = Date.now() + SYNC_WINDOW; // the mirror's own load echo is ours
  mirror.src = currentUrl;
}

// Messages from the mirror iframe
window.addEventListener('message', (e) => {
  if (e.source !== mirror.contentWindow) return;

  if (e.data?.type === 'pfs_mirror_ready') {
    _mirrorReady = true;
    clearBlocked();
    setStatus('ok', '');
  }

  // Mirror navigated (full page reload or SPA pushState) — sync real tab
  if (e.data?.type === 'pfs_mirror_navigated') {
    if (Date.now() < suppressMirrorSync) return; // echo of a load we triggered
    const url = e.data.url;
    if (!url || sameUrl(url, currentUrl)) return;
    currentUrl = url;
    updateBrowserUrl(url);
    suppressTabSync = Date.now() + SYNC_WINDOW;  // swallow the echo coming back from the tab
    if (mode === 'single') {
      if (targetTabId != null) chrome.tabs.update(targetTabId, { url });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.update(tabs[0].id, { url });
      });
    }
  }
});

// After load: if content script never signalled, the iframe showed a Chrome error page
mirror.addEventListener('load', () => {
  if (!currentUrl) return;
  if (!_mirrorReady) {
    showBlocked('Conexão recusada ou site bloqueou o iframe.');
  }
});

function showBlocked(msg) {
  isBlocked = true;
  blockedNotice.classList.add('visible');
  if (msg) blockedNotice.querySelector('p').textContent = msg;
  setStatus('error', 'bloqueado');
}

function clearBlocked() {
  isBlocked = false;
  blockedNotice.classList.remove('visible');
  setStatus('', '');
}

function setStatus(type, text) {
  statusEl.className = 'status' + (type ? ' ' + type : '');
  statusEl.textContent = text;
}

// ── Settings panel ───────────────────────────────────────────────────
function closeSettings() {
  settingsPanel.classList.remove('open');
  settingsBtn.classList.remove('active');
  settingsBtn.setAttribute('aria-expanded', 'false');
  settingsPanel.setAttribute('aria-hidden', 'true');
}

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const opening = !settingsPanel.classList.contains('open');
  settingsPanel.classList.toggle('open', opening);
  settingsBtn.classList.toggle('active', opening);
  settingsBtn.setAttribute('aria-expanded', String(opening));
  settingsPanel.setAttribute('aria-hidden', String(!opening));
});

document.addEventListener('click', (e) => {
  if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
    closeSettings();
  }
});

// Toggle: status bar
document.getElementById('toggle-statusbar').addEventListener('change', (e) => {
  const show = e.target.checked;
  statusBarEl.style.display = show ? '' : 'none';
  screenCutout.style.setProperty('--sb-h', show ? '5.2%' : '0%');
  applyIframeScale(); // inset changed — reflow the mirror
});

// Toggle: home indicator
document.getElementById('toggle-home').addEventListener('change', (e) => {
  homeIndicator.style.display = e.target.checked ? '' : 'none';
});

// ── Status bar ────────────────────────────────────────────────────────
const sbTime    = document.getElementById('sb-time');
const sbBatFill = document.getElementById('sb-bat-fill');

// iOS time format: no leading zero on hours ("9:41", not "09:41")
function updateClock() {
  const now = new Date();
  sbTime.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
}
updateClock();
setInterval(updateClock, 1000);

// Battery: update SVG rect width (max inner width = 17.6 viewBox units)
if ('getBattery' in navigator) {
  navigator.getBattery().then(bat => {
    function applyBat() {
      sbBatFill.setAttribute('width', (bat.level * 17.6).toFixed(2));
      sbBatFill.setAttribute('fill',  bat.level <= 0.20 ? '#FF453A' : 'currentColor');
    }
    applyBat();
    bat.addEventListener('levelchange',    applyBat);
    bat.addEventListener('chargingchange', applyBat);
  }).catch(() => {});
}

// ── Browser bars ─────────────────────────────────────────────────────
// Heights as % of screen cutout height
const BB_TOP_H  = 8.0;  // ~address bar: ~66pt on 844pt screen ≈ 7.8%
const BB_BOT_H  = 9.0;  // ~nav bar:    ~83pt on 844pt screen ≈ 9.8%

function updateBrowserUrl(url) {
  let display = '';
  try {
    const u = new URL(url);
    display = u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch { display = url || ''; }
  if (brSafariUrl) brSafariUrl.textContent = display || '...';
  if (brChromeUrl) brChromeUrl.textContent = display || '...';
}

function applyBrowserBars() {
  const browser = browserSelect.value;
  const showTop    = browser !== 'none' && toggleBrTop.checked;
  const showBottom = browser !== 'none' && toggleBrBottom.checked;

  // Show/hide top bar
  brTop.classList.toggle('visible', showTop);
  brSafariTop.style.display = (showTop && browser === 'safari') ? '' : 'none';
  brChromeTop.style.display = (showTop && browser === 'chrome') ? '' : 'none';

  // Show/hide bottom bar
  brBottom.classList.toggle('visible', showBottom);

  // Switch Safari/Chrome icons in bottom bar
  safariIcons.forEach(el => { el.style.display = browser === 'safari' ? '' : 'none'; });
  chromeIcons.forEach(el => { el.style.display = browser === 'chrome' ? '' : 'none'; });

  // Update CSS height variables
  screenCutout.style.setProperty('--bb-top-h', showTop    ? BB_TOP_H  + '%' : '0%');
  screenCutout.style.setProperty('--bb-bot-h', showBottom ? BB_BOT_H  + '%' : '0%');

  // Show/hide settings toggles section
  browserToggles.style.display = browser !== 'none' ? '' : 'none';

  applyIframeScale(); // insets changed — reflow the mirror
}

browserSelect.addEventListener('change', applyBrowserBars);
toggleBrTop.addEventListener('change', applyBrowserBars);
toggleBrBottom.addEventListener('change', applyBrowserBars);

// ── Messages from background ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  // Track the focused tab (regardless of mode) to drive the "locked elsewhere" overlay.
  if (msg.type === 'pfs_tab_activated') {
    activeTabId = msg.tabId;
    updateLockState();
  }

  // The target-closed notice is not tab-scoped — handle it before the filter.
  if (msg.type === 'pfs_target_closed') {
    targetTabId = null;
    updateLockState();
    showBlocked('A aba espelhada foi fechada.');
    return;
  }

  // In single-tab mode, ignore every event that isn't from the locked tab.
  if (!isSyncTab(msg.tabId)) return;

  switch (msg.type) {
    case 'pfs_scroll':
      mirror.contentWindow?.postMessage({ type: 'pfs_scroll', y: msg.y, x: msg.x }, '*');
      break;

    case 'pfs_media':
      mirror.contentWindow?.postMessage(msg, '*');
      break;

    case 'pfs_tab_navigated':
      if (Date.now() < suppressTabSync) break; // echo of our own mirror-driven navigation
      navigateTo(msg.url);
      break;

    case 'pfs_tab_loading':
      if (Date.now() < suppressTabSync) break; // echo of our own mirror-driven navigation
      reloadMirror();
      break;

    case 'pfs_tab_activated':
      // isSyncTab already filtered out non-target tabs in single mode; returning to
      // the locked tab shouldn't force a reload if it still shows the same URL.
      if (mode === 'single' && sameUrl(msg.url, currentUrl)) break;
      navigateTo(msg.url);
      break;
  }
});

// ── Tab mode toggle ("Funcionar em todas as abas") ────────────────────
if (toggleAllTabs) {
  toggleAllTabs.addEventListener('change', (e) => {
    mode = e.target.checked ? 'all' : 'single';
    chrome.storage.local.set({ pfs_mode: mode });
    // Tell the background to reconfigure panel visibility (contextual vs global).
    chrome.runtime.sendMessage({ type: 'pfs_set_mode', mode, tabId: targetTabId });
    // Re-bind to the current tab: 'all' resumes following it, 'single' locks onto it.
    clearBlocked();
    getActiveTabUrl();
  });
}

// ── Force-embed toggle ("Forçar embed de sites bloqueados") ───────────
if (toggleForceEmbed) {
  toggleForceEmbed.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ pfs_force_embed: enabled });
    chrome.runtime.sendMessage({ type: 'pfs_set_force_embed', enabled });
    // Reload the mirror so the header rule change takes effect on the current site.
    reloadMirror();
  });
}
