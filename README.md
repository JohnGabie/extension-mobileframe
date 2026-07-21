# MobileFrame Simulator

> A Chrome extension that mirrors the active browser tab inside a **real phone frame**, with scroll, media and navigation kept in sync between the real tab and the mirror.

[![CI](https://github.com/JohnGabie/extension-mobileframe/actions/workflows/ci.yml/badge.svg)](https://github.com/JohnGabie/extension-mobileframe/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Download](https://img.shields.io/badge/⬇%20Download-latest%20release-2ea44f)](https://github.com/JohnGabie/extension-mobileframe/releases/latest/download/mobileframe-simulator.zip)

### ⬇️ [Download the latest version](https://github.com/JohnGabie/extension-mobileframe/releases/latest/download/mobileframe-simulator.zip)

Then follow [Installation](#installation) to load it in Chrome (Developer mode → Load unpacked). No Chrome Web Store account needed.

> **Browser support:** Chrome and other Chromium browsers (Edge, Brave, Opera) only.
> **Firefox is not supported** — it lacks the `chrome.sidePanel` API this extension is built on.

MobileFrame Simulator opens a **side panel** showing your current tab inside a photographic phone frame (currently iPhone 13). As you scroll, navigate or reload the real tab, the mirror follows — and vice versa. It's a lightweight way for front-end developers to see a site "on a real phone" without leaving the browser.

## Screenshot

<!-- Add a screenshot at docs/screenshot.png and it will render here. -->
<!-- ![MobileFrame Simulator](docs/screenshot.png) -->

_Screenshot coming soon._

## Features

- **Real device frames** — every phone frame is an actual PNG photo of the device, never drawn in CSS/SVG. The site renders inside the transparent screen cut-out.
- **Two-way sync** — scroll, `<video>`/`<audio>` play·pause, page navigation and F5 reloads stay in sync between the real tab and the mirror.
- **Per-tab (contextual) panel** — the panel opens only on the tab where you launched it and stays hidden on every other tab, so it never follows you around. An optional **"Work on all tabs"** toggle restores the follow-active-tab behavior.
- **Simulated mobile chrome** — optional iOS status bar and Safari/Chrome address & navigation bars, so the mirror looks like a real phone browser.
- **Correct viewport** — the mirror renders at the device's native CSS width (e.g. 390px for iPhone 13) and is scaled to fit, so sites see the real mobile viewport.
- **Zero build step** — plain Vanilla JS, HTML and CSS. No framework, no bundler, no npm dependencies.

## How it works

- The **side panel** (`sidepanel/`) hosts the phone frame image plus an `<iframe>` mirror pointed at the active tab's URL.
- `content-script.js` is injected into **all frames** (`all_frames: true`), so it runs in both the real tab and the mirror iframe. It detects which side it is on and acts accordingly (send scroll/media from the real tab; apply them inside the mirror).
- `background.js` (the MV3 service worker) is the **relay**: all messaging between the real tab and the panel passes through it. It also manages the contextual per-tab side panel via `chrome.sidePanel.setOptions`.

## Embedding blocked sites (by design)

Many sites refuse to load inside an `<iframe>` via `X-Frame-Options` or a CSP `frame-ancestors` directive. Because this is a developer tool, the extension can work around that — but it is scoped, user-controlled and off unless the panel is open:

- The **"Force embed blocked sites"** toggle (Settings → Advanced, on by default) controls this behavior. You can turn it off at any time.
- When enabled, `background.js` uses `declarativeNetRequestWithHostAccess` to strip the `X-Frame-Options` and `Content-Security-Policy` response headers **only** for `resourceTypes: ['sub_frame']`, and **only while the side panel is open** (the rules are added on panel open and removed on close). Your normal top-level browsing is never affected.
- Inside the mirror, `content-script.js` neutralizes JavaScript frame-busting by redefining `window.top` / `window.parent` / `frameElement`.

This is scoped, deliberate and documented — see [SECURITY.md](SECURITY.md) and [PRIVACY.md](PRIVACY.md). When a site still cannot be embedded (e.g. connection refused), the panel shows a friendly notice instead.

## Installation

This extension is not on the Chrome Web Store, so it is installed **unpacked**
(Developer mode). That is normal and expected for a tool distributed via GitHub.

### For testers (no Git needed)

1. **[⬇️ Download `mobileframe-simulator.zip`](https://github.com/JohnGabie/extension-mobileframe/releases/latest/download/mobileframe-simulator.zip)** (latest release).
2. **Unzip** it somewhere you'll keep it (deleting the folder removes the extension).
3. Open **`chrome://extensions`** in Chrome.
4. Turn on **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the unzipped folder (the one containing
   `manifest.json`).
6. Pin the extension and click its icon on any tab to open the mirror.

> To update later, download the ZIP again and repeat, or click **Reload** on the
> extension card in `chrome://extensions`.

### From source (developers)

```bash
git clone https://github.com/JohnGabie/extension-mobileframe.git
```

Then follow steps 3–6 above, selecting the cloned folder.

## Usage

- **Click the toolbar icon** on the tab you want to mirror — the panel opens locked to that tab.
- **Switch tabs** — the panel stays hidden on other tabs (it's contextual), so it never follows you to unrelated tabs.
- **Settings** (list icon in the panel) — pick a device, toggle the iOS status bar / browser bars, enable **"Work on all tabs"** to make the mirror follow whichever tab is active, or toggle **"Force embed blocked sites"** (Advanced).

## Supported devices & adding a new one

Currently bundled: **iPhone 13**.

Device frames are **always real PNG photos** of the device — never drawn in code. To add a new device:

1. Get a straight-on photo of the device with a clean screen and save it as `assets/frames/{maker}-{model}.png` (e.g. `iphone-13.png`).
2. Measure the transparent screen area (x, y, width, height in image pixels).
3. Add an entry to [`assets/frame-config.json`](assets/frame-config.json):

   ```json
   {
     "iphone-13": {
       "label": "iPhone 13",
       "image": "frames/iphone-13.png",
       "imageWidth": 859,
       "imageHeight": 1738,
       "screen": { "x": 42, "y": 34, "width": 779, "height": 1668 },
       "borderRadius": 88,
       "cssWidth": 390,
       "cssHeight": 844
     }
   }
   ```

4. Add a matching `<option>` to the device `<select>` in `sidepanel/panel.html`.

No CSS or JS changes are needed to add a device — only the JSON and the option. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Project structure

```
manifest.json          # MV3 manifest
background.js           # service worker: message relay + contextual side panel + header rules
content-script.js       # injected in all frames; runs in the real tab and the mirror
sidepanel/
  panel.html            # phone frame + mirror iframe + simulated mobile chrome
  panel.js              # device switching, scaling, sync, tab-lock logic
  panel.css
assets/
  frames/*.png          # real device photos
  frame-config.json     # screen coordinates per device
icons/                  # extension icons
```

## Development

- **No build step.** Edit the files and reload the extension.
- After changing `manifest.json` or `background.js`, click **reload** on the extension in `chrome://extensions`.
- After changing `content-script.js`, reload the extension **and** press F5 on open tabs (the old script keeps running until the page reloads).
- Always test on at least two sites: a simple static page and a heavy SPA, to catch sync regressions early.
- Sanity-check JS before committing: `node --check background.js content-script.js sidepanel/panel.js`.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) before opening an issue or pull request.

## License

Licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE).

## Disclaimer

MobileFrame Simulator is a developer tool. It embeds third-party sites for local inspection only; respect the terms of service of any site you load, and do not use it to circumvent access controls.
