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
let _skipNextTabUpdate = false; // suppresses echo when mirror drives real-tab navigation

// ── Load config and boot ──────────────────────────────────────────────
fetch(BASE + 'frame-config.json')
  .then(r => r.json())
  .then(data => {
    config = data;
    applyDevice(currentDevice);
    getActiveTabUrl();
  });

function getActiveTabUrl() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) navigateTo(tabs[0].url);
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
function applyIframeScale() {
  const dev = _currentDev;
  if (!dev?.cssWidth) return;
  const cw = screenCutout.offsetWidth;
  const ch = screenCutout.offsetHeight;
  if (!cw || !ch) return;
  const scale = cw / dev.cssWidth;
  mirror.style.width     = dev.cssWidth + 'px';
  mirror.style.height    = Math.ceil(ch / scale) + 'px';
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
  mirror.src = url;
  updateBrowserUrl(url);
}

function reloadMirror() {
  if (!currentUrl) return;
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
    const url = e.data.url;
    if (!url || url === currentUrl) return;
    currentUrl = url;
    updateBrowserUrl(url);
    _skipNextTabUpdate = true;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.update(tabs[0].id, { url });
    });
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
}

browserSelect.addEventListener('change', applyBrowserBars);
toggleBrTop.addEventListener('change', applyBrowserBars);
toggleBrBottom.addEventListener('change', applyBrowserBars);

// ── Messages from background ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  switch (msg.type) {
    case 'pfs_scroll':
      mirror.contentWindow?.postMessage({ type: 'pfs_scroll', y: msg.y, x: msg.x }, '*');
      break;

    case 'pfs_media':
      mirror.contentWindow?.postMessage(msg, '*');
      break;

    case 'pfs_tab_navigated':
      // If this is the echo of our own mirror-driven navigation, ignore it
      if (_skipNextTabUpdate && msg.url === currentUrl) {
        _skipNextTabUpdate = false;
      } else {
        navigateTo(msg.url);
      }
      break;

    case 'pfs_tab_loading':
      if (!_skipNextTabUpdate) reloadMirror();
      break;

    case 'pfs_tab_activated':
      navigateTo(msg.url);
      break;
  }
});
