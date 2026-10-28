// video-counter content script
//
// Counts the YouTube Shorts / regular videos you open and the real time you
// spend actually playing them. Everything is stored locally in
// chrome.storage.local as { "YYYY-MM-DD": { shorts: {count, seconds}, videos: {count, seconds} } }.
(() => {
  'use strict';

  const TYPES = ['shorts', 'videos'];
  const TICK_MS = 1000; // sample playback state once per second
  const FLUSH_MS = 10000; // write to storage every 10 seconds, not every second
  const SESSION_KEY = 'video-counter:last';

  const empty = () => ({
    shorts: { count: 0, seconds: 0 },
    videos: { count: 0, seconds: 0 },
  });

  const pad = (n) => String(n).padStart(2, '0');
  const localDay = (d = new Date()) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let pending = empty(); // counted in memory, not yet written
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

  // Shorts: /shorts/<id>    Regular videos: /watch?v=<id>
  function getCurrent() {
    const { pathname, searchParams } = new URL(location.href);
    if (/^\/shorts\/[\w-]+/.test(pathname)) {
      return { type: 'shorts', key: pathname };
    }
    if (pathname === '/watch' && searchParams.get('v')) {
      return { type: 'videos', key: 'v=' + searchParams.get('v') };
    }
    return null;
  }

  // Any <video> actually playing counts, so we do not depend on YouTube's DOM
  // layout. Real seconds are counted (not video time), so 2x speed is not inflated.
  function isPlaying() {
    for (const v of document.querySelectorAll('video')) {
      if (!v.paused && !v.ended && v.readyState > 2) return true;
    }
    return false;
  }

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

    const cur = getCurrent();
    if (!cur) {
      setLast(null); // left the video: opening it again counts again
      return;
    }
    if (document.hidden) return; // only count tabs you are looking at

    if (cur.key !== lastKey) {
      setLast(cur.key);
      pending[cur.type].count++;
    }
    if (isPlaying()) pending[cur.type].seconds++;
  }

  // Several tabs may flush at once; the Web Lock keeps read-modify-write atomic.
  function withLock(fn) {
    return navigator.locks ? navigator.locks.request('video-counter-flush', fn) : fn();
  }

  async function flush() {
    const snap = pending;
    const day = pendingDay;
    if (!TYPES.some((t) => snap[t].count || snap[t].seconds)) return;
    pending = empty(); // reset synchronously so nothing is counted twice

    try {
      await withLock(async () => {
        const res = await chrome.storage.local.get(day);
        const data = res[day] || empty();
        for (const t of TYPES) {
          const cur = data[t] || { count: 0, seconds: 0 };
          data[t] = {
            count: (cur.count || 0) + snap[t].count,
            seconds: (cur.seconds || 0) + snap[t].seconds,
          };
        }
        await chrome.storage.local.set({ [day]: data });
      });
    } catch (_) {
      if (!alive() || day !== pendingDay) return;
      // Writing failed: put the numbers back and retry on the next flush.
      for (const t of TYPES) {
        pending[t].count += snap[t].count;
        pending[t].seconds += snap[t].seconds;
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
