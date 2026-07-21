# Chrome Web Store — listing guide (for maintainers)

Copy/paste material and answers for the Chrome Web Store Developer Dashboard. This file
is **not** part of the packaged extension (the release workflow zips only
`manifest.json`, `background.js`, `content-script.js`, `sidepanel/`, `assets/`, `icons/`).

Positioning that keeps this type of extension approved: present it clearly as a
**developer / testing tool**, be transparent that it disables anti-framing protections
only inside its own mirror, request the minimum permissions, and collect no data.

---

## Single purpose

> Mirror the active browser tab inside a realistic phone frame so developers can preview
> and test how a site looks and behaves at a mobile viewport, without opening DevTools.

## Short description (≤132 chars)

> Preview any tab inside a real phone frame with synced scroll, navigation and reload — a
> side-panel responsive testing tool.

## Detailed description

> MobileFrame Simulator shows your current tab inside a photographic phone frame in the
> browser side panel. Scroll, navigation, media play/pause and F5 reloads stay in sync
> between the real tab and the mirror, so you can see how a site behaves at a real mobile
> viewport (e.g. 390px for iPhone 13) without leaving the page.
>
> Features:
> • Real device frames (actual device photos, not CSS drawings).
> • Two-way scroll / navigation / reload sync.
> • Per-tab panel: opens only on the tab you launched it from.
> • Optional simulated iOS status bar and Safari/Chrome browser bars.
>
> Developer tool notice: some sites refuse to load in a frame via X-Frame-Options or a
> Content-Security-Policy. When you enable "Force embed" (a setting in the panel), the
> extension removes those headers ONLY for its own mirror iframe, ONLY while the panel is
> open. Your normal browsing is never affected. This is intended for local development
> and testing of sites you are authorized to inspect.
>
> Privacy: no data collection, no tracking, no external servers — everything runs locally
> in your browser.

## Category

Developer Tools

## Privacy practices (dashboard answers)

- **Does this item collect user data?** No.
- **Data usage**: none collected, none sold, none transferred.
- **Privacy policy URL**: https://github.com/JohnGabie/extension-mobileframe/blob/master/PRIVACY.md

## Permission justifications (dashboard fields)

- **sidePanel** — Displays the phone-frame mirror UI in the browser side panel.
- **tabs** — Reads the active tab's URL to mirror it and keeps navigation/reload in sync
  between the real tab and the mirror.
- **storage** — Persists user preferences (selected device, "work on all tabs" mode,
  "force embed" toggle) locally.
- **host permission `<all_urls>`** — The tool must work on whatever site the developer is
  testing, which cannot be predicted in advance.
- **declarativeNetRequestWithHostAccess** — Lets the developer's own mirror iframe load
  sites that set anti-framing headers. Header removal (X-Frame-Options,
  Content-Security-Policy) is limited to `sub_frame` requests, is active only while the
  side panel is open and the user has enabled "Force embed", and never modifies
  top-level navigation. No blocking web request interception is used.

## Content script justification

- The content script runs in all frames to synchronize scroll and media between the real
  tab and the mirror iframe (they are separate frames of the same URL). Inside the mirror
  only, it neutralizes JavaScript frame-busting so scoped embedding works.

## Manual assets to prepare (cannot be automated)

- [ ] At least one screenshot — **1280×800** or **640×400** PNG/JPG (panel + a site
      mirrored).
- [ ] Small promo tile — **440×280** PNG.
- [ ] (Optional) Marquee promo — 1400×560.
- [ ] Store icon 128×128 (already in `icons/icon128.png`).

## Publish steps

1. Register at https://chrome.google.com/webstore/devconsole (one-time US$5 fee).
2. Package: run the release workflow or zip the files listed above.
3. Create the item, upload the zip, fill in the fields from this document, add
   screenshots + promo tile.
4. Complete the Privacy practices tab and submit for review.
5. After first approval, grab the extension ID and configure the `release.yml` secrets
   (`CHROME_EXTENSION_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REFRESH_TOKEN`) to automate future releases.
