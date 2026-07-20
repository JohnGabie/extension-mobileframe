# Contributing to MobileFrame Simulator

Thanks for your interest in contributing! This is a small, dependency-free Chrome
extension, so getting started is quick.

## Development setup

There is **no build step**. Clone the repo and load it unpacked:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the project folder.

### Reload rules (important)

Chrome does not hot-reload extensions. After editing:

- **`manifest.json` or `background.js`** → click **reload** on the extension in `chrome://extensions`.
- **`content-script.js`** → reload the extension **and** press F5 on any open tabs (the previously injected script keeps running until the page reloads).
- **`sidepanel/*`** → just reopen the side panel.

## Project conventions

- **Vanilla JS + HTML/CSS only.** No framework (React/Vue), no bundler (webpack/vite), no npm dependencies. If you think a dependency or build step is genuinely needed, open an issue to discuss it first.
- **Manifest V3.**
- **Messaging always goes through `background.js`.** Don't attempt direct cross-context communication between the real tab and the panel — route it through the service worker.
- **The content script runs in every frame** (`all_frames: true`). It must detect whether it is the real tab or the mirror iframe before acting — never assume a single instance.
- **Device frames are always real PNG photos.** Never draw a device frame in SVG, CSS or canvas.
- **Screen coordinates live only in `assets/frame-config.json`** — never hard-code them in CSS/JS.

## Adding a new device

1. Save a straight-on photo of the device (clean, ideally transparent screen area) as `assets/frames/{maker}-{model}.png`, e.g. `iphone-13.png`.
2. Measure the transparent screen rectangle in the image (x, y, width, height, in image pixels) and the corner radius.
3. Add an entry to `assets/frame-config.json`:

   ```json
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
   ```

   - `imageWidth`/`imageHeight`: the PNG's pixel dimensions.
   - `screen`: the transparent screen area, in image pixels.
   - `cssWidth`/`cssHeight`: the device's logical CSS viewport (what sites should see).
4. Add a matching `<option>` to the device `<select>` in `sidepanel/panel.html`.

No CSS or JS changes are required — the panel reads the JSON at runtime.

## Testing your change

Before opening a pull request:

1. **Syntax check** the JS: `node --check background.js content-script.js sidepanel/panel.js`.
2. **Validate JSON**: `manifest.json` and `assets/frame-config.json` must stay valid.
3. **Manual test** on at least two sites — a simple static page and a heavy SPA — to catch scroll/navigation sync regressions.
4. If you touched the tab-lock logic, verify: opening on one tab locks to it, other tabs stay hidden, closing the locked tab shows the "tab closed" notice, and the "Work on all tabs" toggle works.

CI (`.github/workflows/ci.yml`) runs the JSON and JS checks automatically on pull requests.

## Pull request process

1. Fork the repo and create a topic branch.
2. Keep changes focused; match the style of the surrounding code.
3. Update the README/docs if your change affects usage or setup.
4. Fill in the pull request template checklist.
5. Open the PR against `master`.

By contributing, you agree that your contributions will be licensed under the project's
[GPL-3.0](LICENSE) license.
