# video-counter

A desktop browser extension that counts how many YouTube Shorts and videos you watch each day, and how much time they eat.

一個桌機瀏覽器擴充功能，統計你每天看了幾支 YouTube Shorts 和一般影片，以及花了多少時間。

> Just for fun, not for productivity. 好玩用的，不是什麼實用工具。

## Features / 功能

- Counts Shorts (`/shorts/ID`) and regular videos (`/watch?v=ID`) separately
- Tracks real time spent: only seconds when a video is actually playing in the tab you are looking at, so 2x speed does not inflate it and a paused video does not count
- Popup shows today's total, a Shorts / videos breakdown, and a 7-day stacked chart
- All data stays in your browser (`chrome.storage.local`), nothing is sent anywhere
- English and Traditional Chinese UI (follows your browser language)

## Install / 安裝

Desktop browsers only. Chrome, Edge, Brave, Opera and Vivaldi all load the same files; Firefox works too.

僅支援桌機瀏覽器。

### Chrome / Edge / Brave (Chromium)

1. Download or clone this repo
2. Open `chrome://extensions` and enable Developer mode
3. Click "Load unpacked" and select the repo folder

Chrome may show a harmless warning about the unrecognized manifest key `browser_specific_settings`. It is only used by Firefox.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" and select `manifest.json`
   (temporary add-ons are removed when Firefox restarts)
3. If nothing is being counted, open `about:addons`, select Video Counter, and make sure access to `www.youtube.com` is allowed under Permissions

## How it works / 運作方式

- `content.js` runs on `www.youtube.com`. Once per second it checks the current URL and whether any `<video>` is playing.
- When the URL changes to a new video, the count goes up by one. Leaving a video page and coming back counts again; a plain refresh does not.
- Numbers are batched in memory and written to storage every 10 seconds and when the tab is hidden or closed.
- `popup.html` / `popup.js` read the stored data and draw the charts.

Stored format, one record per local day:

```json
{
  "2026-10-28": {
    "shorts": { "count": 47, "seconds": 2280 },
    "videos": { "count": 6, "seconds": 4320 }
  }
}
```

## Project layout / 專案結構

```
video-counter/
├── manifest.json
├── content.js
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

- Only `www.youtube.com` is covered. `music.youtube.com`, embedded players and mobile are not.
- Ads and the video share one player, so ad time counts as time spent.
- A hover preview playing on a video page can add a few seconds.
- If YouTube changes its URL scheme, the counting logic in `getCurrent()` needs updating.

## Privacy / 隱私

Only the `storage` permission is used, and the extension only runs on `www.youtube.com`. No network requests, no tracking. Use "Clear data" in the popup to delete everything.

## License

MIT
