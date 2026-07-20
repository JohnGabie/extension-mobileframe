# Security Policy

## Reporting a vulnerability

Please report security issues privately. Do **not** open a public issue for a
vulnerability.

- Preferred: open a [GitHub Security Advisory](https://github.com/JohnGabie/extension-mobileframe/security/advisories/new) for this repository.
- Or email: **joao.g.almeida2@gmail.com**

Please include steps to reproduce, the affected version, and the impact. We aim to
acknowledge reports within a reasonable time and will credit reporters who wish to be
named.

## Supported versions

Only the latest release / `master` receives fixes.

## Intentional behavior (not a vulnerability)

MobileFrame Simulator is a **developer tool** and, by design, actively tries to embed
sites that would normally refuse to load in an `<iframe>`. This is deliberate and
tightly scoped to the mirror iframe:

- **Header stripping** — `background.js` uses `declarativeNetRequest` to remove the
  `X-Frame-Options` and `Content-Security-Policy` response headers **only** for
  `resourceTypes: ['sub_frame']`. Top-level (main-frame) navigation — your normal
  browsing — is **never** modified.
- **Frame-busting neutralization** — inside the mirror iframe only, `content-script.js`
  redefines `window.top` / `window.parent` / `frameElement` so scripts that try to
  break out of a frame don't force a reload.

### Trust model

- These behaviors affect **only** content the user explicitly loads into the extension's
  own mirror panel. They do not weaken the security of the pages the user browses
  normally.
- The extension makes no network requests of its own, uses no external servers or
  proxies, and rewrites no page content beyond the frame-busting neutralization above.
- Because the extension requests `<all_urls>` host permissions and strips security
  headers for sub-frames, install it only from source you trust and review.

If you believe any of the above can be abused **beyond** the mirror iframe (for example,
affecting main-frame requests or other extensions/tabs), that **would** be a security
issue — please report it via the channels above.
