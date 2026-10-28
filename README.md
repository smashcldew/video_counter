# video-counter

A desktop browser extension that counts how many short videos you watch each day (YouTube Shorts, YouTube videos, Instagram Reels) and how much time they eat.

一個桌機瀏覽器擴充功能，統計你每天看了幾支 YouTube Shorts、YouTube 影片和 Instagram Reels，以及花了多少時間。

> Just for fun, not for productivity. 好玩用的，不是什麼實用工具。

## Features / 功能

- Counts each kind separately: YouTube Shorts, YouTube videos, Instagram Reels
- Tracks real time spent: only seconds when a video is actually playing in the tab you are looking at, so 2x speed does not inflate it and a paused video does not count
- Popup shows today's total, a breakdown per platform, and a 7-day stacked chart. A platform only appears once it has data.
- All data stays in your browser (`chrome.storage.local`), nothing is sent anywhere
- English and Traditional Chinese UI (follows your browser language)

## Supported pages / 支援範圍

| Platform | Counted | URL |
|---|---|---|
| YouTube | Shorts | `/shorts/<id>` |
| YouTube | Videos | `/watch?v=<id>` |
| Instagram | Reels only | `/reels/`, `/reels/<code>/`, `/reel/<code>/` |

The Instagram home feed is not counted: its videos autoplay inline and the page address never changes, so there is nothing reliable to detect.

## Install / 安裝

Desktop browsers only. Chrome, Edge, Brave, Opera and Vivaldi all load the same files; Firefox works too.

僅支援桌機瀏覽器。

### Chrome / Edge / Brave (Chromium)

1. Download or clone this repo
2. Open `chrome://extensions` (Edge: `edge://extensions`) and enable Developer mode
3. Click "Load unpacked" and select the repo folder

Chrome may show a harmless warning about the unrecognized manifest key `browser_specific_settings`. It is only used by Firefox.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" and select `manifest.json`
   (temporary add-ons are removed when Firefox restarts)
3. If nothing is being counted, open `about:addons`, select Video Counter, and make sure access to `www.youtube.com` and `www.instagram.com` is allowed under Permissions

### Updating from 0.1

Just reload the extension. Data counted by 0.1 (YouTube only) is converted automatically, nothing is lost. If a page was already open, refresh it so the new scripts load.

## How it works / 運作方式

- On each supported site, the browser loads `shared.js`, that site's adapter from `platforms/`, and `core.js`.
- The adapter only answers one question: "what is this page?" It returns nothing for pages that are not countable, or the kind of video plus a key that identifies it.
- `core.js` does the rest. Once per second it asks the adapter and checks whether any `<video>` is playing. A new key counts as one video. Leaving a video page and coming back counts again; a plain refresh does not.
- Numbers are batched in memory and written to storage every 10 seconds and when the tab is hidden or closed.
- `popup.html` / `popup.js` read the stored data and draw the charts.

Stored format, one record per local day, keyed by `<platform>:<type>`:

```json
{
  "2026-10-28": {
    "youtube:shorts": { "count": 47, "seconds": 2280 },
    "youtube:videos": { "count": 6, "seconds": 4320 },
    "instagram:reels": { "count": 30, "seconds": 1500 }
  }
}
```

## Adding a platform / 新增平台

1. Create `platforms/<site>.js` that sets `globalThis.VC_PLATFORM = { id, getCurrent(url, ctx) }`. Use `platforms/youtube.js` as a template. `getCurrent` returns `null` or `{ type, key }`.
2. Add a `content_scripts` entry and the host permission in `manifest.json`, loading `shared.js`, your adapter and `core.js` in that order.
3. Add the type to `TYPES` in `shared.js`, a `--c-<platform>-<type>` colour in `popup.css`, and a `type_<platform>_<type>` text in both `_locales` files.

## Project layout / 專案結構

```
video-counter/
├── manifest.json
├── shared.js            types, local-day helper, data migration
├── core.js              counting, timing, storing
├── platforms/
│   ├── youtube.js
│   └── instagram.js
├── popup.html
├── popup.css
├── popup.js
├── icons/
├── _locales/
│   ├── en/messages.json
│   └── zh_TW/messages.json
├── LICENSE
└── README.md
```

## Limitations / 已知限制

- Only `www.youtube.com` and `www.instagram.com` are covered. `music.youtube.com`, embedded players and mobile are not.
- Ads and the video share one player, so ad time counts as time spent.
- A hover preview playing on a video page can add a few seconds.
- Instagram changes its site often. If the Reels feed keeps the bare `/reels/` address while you scroll, reels are told apart by the playing `<video>` element instead, and the first reel of a session may be counted twice.
- If a site changes its URL scheme, the matching adapter's `getCurrent()` needs updating.

## Privacy / 隱私

Only the `storage` permission is used, and the extension only runs on `www.youtube.com` and `www.instagram.com`. No network requests, no tracking. Use "Clear data" in the popup to delete everything.

## License

MIT
