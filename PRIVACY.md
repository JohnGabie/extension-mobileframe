# Privacy Policy — MobileFrame Simulator

_Last updated: 2026-07_

MobileFrame Simulator is a developer tool that mirrors the active browser tab inside a
phone frame for responsive testing. **It does not collect, transmit, or sell any data.**

## What we collect

**Nothing.** The extension has no analytics, no telemetry, no accounts, and makes no
network requests of its own. It does not use any external server, proxy, or third-party
service.

## Data stored locally

The extension uses Chrome's local storage only to remember your **preferences** on your
own device:

- selected device frame,
- "Work on all tabs" mode,
- "Force embed blocked sites" preference.

This data never leaves your browser and is removed if you uninstall the extension.

## Permissions and why they are needed

- **`sidePanel`** — to show the phone-frame mirror in the browser side panel.
- **`tabs`** — to read the active tab's URL so it can be mirrored, and to keep
  navigation in sync between the real tab and the mirror.
- **`storage`** — to save the preferences listed above.
- **`declarativeNetRequestWithHostAccess`** and host access to `<all_urls>` — to let the
  mirror iframe load sites that would otherwise refuse to be framed. Header modification
  is scoped to the mirror's sub-frame requests, applies only while the panel is open and
  only when you enable "Force embed", and never affects your normal top-level browsing.

The content the extension loads into the mirror is the page you are already viewing; it
is displayed locally and is not sent anywhere.

## Contact

Questions about privacy? Open an issue or email **joao.g.almeida2@gmail.com**.
