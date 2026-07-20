const isMainFrame = window.self === window.top;
// window.name is cleared by Chrome on cross-origin navigation, so use ancestorOrigins instead.
// When inside our mirror iframe the immediate parent is the extension side panel.
const isMirror = !isMainFrame &&
  (location.ancestorOrigins?.[0]?.startsWith('chrome-extension://') ?? false);

// Only act in the two relevant contexts
if (!isMainFrame && !isMirror) {
  // some random iframe inside the page — do nothing
} else if (isMainFrame) {
  // Scroll sync → background → panel
  let pending = false;
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      chrome.runtime.sendMessage({ type: 'pfs_scroll', y: window.scrollY, x: window.scrollX });
      pending = false;
    });
  }, { passive: true });

  // Media sync: relay play/pause events indexed by position among all media elements
  function sendMedia(action, el) {
    const index = Array.from(document.querySelectorAll('video, audio')).indexOf(el);
    if (index === -1) return;
    chrome.runtime.sendMessage({ type: 'pfs_media', action, index });
  }
  function attachMedia(el) {
    if (el._pfs) return;
    el._pfs = true;
    el.addEventListener('play',  () => sendMedia('play',  el));
    el.addEventListener('pause', () => sendMedia('pause', el));
  }
  new MutationObserver(() => {
    document.querySelectorAll('video, audio').forEach(attachMedia);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.querySelectorAll('video, audio').forEach(attachMedia);

} else if (isMirror) {
  // Neutralize JS frame-busting by redefining top/parent/frameElement in the page's own JS world.
  // Must run before page scripts (document_start) so the checks see the overridden values.
  const bust = document.createElement('script');
  bust.textContent = `(function(){try{
    var w=window;
    Object.defineProperty(w,'top',         {get:function(){return w;},configurable:true});
    Object.defineProperty(w,'parent',      {get:function(){return w;},configurable:true});
    Object.defineProperty(w,'frameElement',{get:function(){return null;},configurable:true});
  }catch(e){}})();`;
  document.documentElement.appendChild(bust);
  bust.remove();

  // Hide scrollbars
  const s = document.createElement('style');
  s.textContent = '::-webkit-scrollbar{display:none!important}html,body{scrollbar-width:none!important;overflow:-moz-scrollbars-none!important}';
  document.documentElement.prepend(s);

  // Signal ready + current URL (covers full-page navigations)
  window.parent.postMessage({ type: 'pfs_mirror_ready' }, '*');
  window.parent.postMessage({ type: 'pfs_mirror_navigated', url: location.href }, '*');

  // SPA route changes — three layers to catch every router pattern:
  function _notifyNav() {
    window.parent.postMessage({ type: 'pfs_mirror_navigated', url: location.href }, '*');
  }

  // 1. Prototype-level wrap (catches frameworks that call History.prototype.pushState directly)
  const _origPush    = History.prototype.pushState;
  const _origReplace = History.prototype.replaceState;
  History.prototype.pushState    = function(...a) { _origPush.apply(this, a);    _notifyNav(); };
  History.prototype.replaceState = function(...a) { _origReplace.apply(this, a); _notifyNav(); };

  // 2. popstate covers back/forward navigation
  window.addEventListener('popstate', _notifyNav);

  // 3. Polling fallback — catches custom routers that bypass History API entirely (e.g. hash routers)
  let _lastHref = location.href;
  setInterval(() => {
    if (location.href !== _lastHref) { _lastHref = location.href; _notifyNav(); }
  }, 300);

  // Mirror is always muted — only the real tab produces audio
  function muteEl(el) {
    if (el._pfsMuted) return;
    el._pfsMuted = true;
    el.muted = true;
  }
  new MutationObserver(() => {
    document.querySelectorAll('video, audio').forEach(muteEl);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.querySelectorAll('video, audio').forEach(muteEl);

  // Receive scroll + play/pause commands from panel
  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'pfs_scroll') {
      window.scrollTo({ top: e.data.y, left: e.data.x, behavior: 'instant' });
    } else if (e.data.type === 'pfs_media') {
      const el = document.querySelectorAll('video, audio')[e.data.index];
      if (!el) return;
      el.muted = true;
      if (e.data.action === 'play') el.play().catch(() => {});
      else el.pause();
    }
  });
}
