// YouTube adapter.
//   Shorts:         /shorts/<id>
//   Regular video:  /watch?v=<id>
//
// getCurrent(url) returns null when the page is not a video page, otherwise
// { type, key } where `key` identifies the video (see core.js).
globalThis.VC_PLATFORM = {
  id: 'youtube',

  getCurrent(url) {
    const { pathname, searchParams } = url;
    if (/^\/shorts\/[\w-]+/.test(pathname)) {
      return { type: 'shorts', key: pathname };
    }
    if (pathname === '/watch' && searchParams.get('v')) {
      return { type: 'videos', key: 'v=' + searchParams.get('v') };
    }
    return null;
  },
};
