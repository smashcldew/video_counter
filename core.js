// video-counter core
//
// Runs on every supported site together with exactly one platform adapter
// (platforms/<site>.js). The adapter only answers "what is this page?"; this
// file does the counting, timing, batching and storing.
//
// Stored in chrome.storage.local, one record per local day:
//   { "YYYY-MM-DD": { "youtube:shorts": { count, seconds }, "instagram:reels": { ... } } }
(() => {
  'use strict';

  const platform = globalThis.VC_PLATFORM;
  if (!platform) return;
  const { localDay, migrateDay } = globalThis.VC;

  const TICK_MS = 1000; // sample playback state once per second
  const FLUSH_MS = 10000; // write to storage every 10 seconds, not every second
  const SESSION_KEY = `video-counter:last:${platform.id}`;

  let pending = {}; // counted in memory, not yet written: { typeId: { count, seconds } }
  let pendingDay = localDay(); // which day `pending` belongs to
  let lastKey = null; // the video we have already counted
  let tickTimer = null;
  let flushTimer = null;

  // Survive an F5 without counting the same video twice.
  try {
    lastKey = sessionStorage.getItem(SESSION_KEY);
  } catch (_) {
    /* storage can be blocked; ignore */
  }

  function setLast(key) {
    if (key === lastKey) return;
    lastKey = key;
    try {
      if (key === null) sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, key);
    } catch (_) {
      /* ignore */
    }
  }

  function bump(typeId, field, n) {
    const entry = pending[typeId] || (pending[typeId] = { count: 0, seconds: 0 });
    entry[field] += n;
  }

  // Real <video> elements get a stable number so an adapter can tell videos apart
  // when the URL does not change. This only looks at <video> elements, never at
  // a site's own markup, which changes all the time.
  const elementIds = new WeakMap();
  let nextElementId = 1;

  // Returns a key for the video that is playing right now, or null if none is.
  function playingVideoKey() {
    for (const v of document.querySelectorAll('video')) {
      if (!v.paused && !v.ended && v.readyState > 2) {
        if (!elementIds.has(v)) elementIds.set(v, nextElementId++);
        return `${elementIds.get(v)}:${v.currentSrc || v.src || ''}`;
      }
    }
    return null;
  }

  const ctx = { playingVideoKey };

  // After the extension is reloaded or updated, old content scripts lose access
  // to the chrome.* APIs. Detect that and stop quietly.
  function alive() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function stop() {
    clearInterval(tickTimer);
    clearInterval(flushTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    removeEventListener('pagehide', onPageHide);
  }

  function tick() {
    if (!alive()) return stop();

    const today = localDay();
    if (today !== pendingDay) {
      flush(); // writes what we have to the previous day
      pendingDay = today;
    }

    // The adapter returns null (not a video page) or { type, key }. A null key
    // means "on a video page but cannot tell which video yet": time still counts,
    // the video is counted once a key is known.
    const cur = platform.getCurrent(new URL(location.href), ctx);
    if (!cur) {
      setLast(null); // left the video: opening it again counts again
      return;
    }
    if (document.hidden) return; // only count tabs you are looking at

    const typeId = `${platform.id}:${cur.type}`;
    if (cur.key != null && cur.key !== lastKey) {
      setLast(cur.key);
      bump(typeId, 'count', 1);
    }
    if (playingVideoKey() !== null) bump(typeId, 'seconds', 1);
  }

  // Several tabs may flush at once; the Web Lock keeps read-modify-write atomic.
  function withLock(fn) {
    return navigator.locks ? navigator.locks.request('video-counter-flush', fn) : fn();
  }

  async function flush() {
    const snap = pending;
    const day = pendingDay;
    const ids = Object.keys(snap);
    if (!ids.some((id) => snap[id].count || snap[id].seconds)) return;
    pending = {}; // reset synchronously so nothing is counted twice

    try {
      await withLock(async () => {
        const res = await chrome.storage.local.get(day);
        const data = migrateDay(res[day]); // also converts 0.1-format records
        for (const id of ids) {
          const cur = data[id] || { count: 0, seconds: 0 };
          data[id] = {
            count: cur.count + snap[id].count,
            seconds: cur.seconds + snap[id].seconds,
          };
        }
        await chrome.storage.local.set({ [day]: data });
      });
    } catch (_) {
      if (!alive() || day !== pendingDay) return;
      // Writing failed: put the numbers back and retry on the next flush.
      for (const id of ids) {
        bump(id, 'count', snap[id].count);
        bump(id, 'seconds', snap[id].seconds);
      }
    }
  }

  function onVisibility() {
    if (document.hidden) flush();
  }

  function onPageHide() {
    flush();
  }

  tickTimer = setInterval(tick, TICK_MS);
  flushTimer = setInterval(flush, FLUSH_MS);
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pagehide', onPageHide);
})();
