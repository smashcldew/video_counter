// Instagram adapter. Reels only: the home feed is deliberately not counted,
// because its videos autoplay inline without any URL change.
//
//   A reel:          /reel/<code>/   /reels/<code>/   /<user>/reel/<code>/
//   The Reels feed:  /reels/
//
// Scrolling the Reels feed is expected to put each reel's code in the URL. If a
// browser keeps the bare /reels/ address instead, fall back to telling reels
// apart by the <video> element that is playing (see playingVideoKey in core.js).
// The only drawback of the fallback is that the first reel can be counted twice
// when the URL switches from the bare form to a code.
globalThis.VC_PLATFORM = {
  id: 'instagram',

  getCurrent(url, ctx) {
    const path = url.pathname;

    const m = path.match(/^\/(?:[^/]+\/)?reels?\/([\w-]+)/);
    if (m && m[1] !== 'audio') {
      return { type: 'reels', key: 'reel:' + m[1] };
    }

    if (/^\/reels\/?$/.test(path)) {
      const playing = ctx.playingVideoKey();
      return { type: 'reels', key: playing ? 'el:' + playing : null };
    }

    return null;
  },
};
