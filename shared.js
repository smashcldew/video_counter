// Shared by the content scripts and the popup: the list of countable types,
// the local-day helper and the stored-data migration. Loaded as a plain script
// (no modules), so everything hangs off one global, VC.
(() => {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');

  // Every countable thing is "<platform>:<type>". To add one, add it here, add its
  // colour variable in popup.css and its `type_<platform>_<type>` text in _locales.
  const TYPES = [
    { id: 'youtube:shorts', color: '--c-youtube-shorts' },
    { id: 'youtube:videos', color: '--c-youtube-videos' },
    { id: 'instagram:reels', color: '--c-instagram-reels' },
  ];

  // Version 0.1 stored { shorts, videos } for YouTube only. Rewrite that to the
  // prefixed form so old data keeps working. Always returns a fresh plain object.
  const LEGACY = { shorts: 'youtube:shorts', videos: 'youtube:videos' };

  function migrateDay(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
      const id = LEGACY[key] || key;
      const prev = out[id] || { count: 0, seconds: 0 };
      out[id] = {
        count: prev.count + ((value && value.count) || 0),
        seconds: prev.seconds + ((value && value.seconds) || 0),
      };
    }
    return out;
  }

  globalThis.VC = {
    TYPES,
    migrateDay,
    localDay: (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    labelKey: (id) => 'type_' + id.replace(':', '_'),
  };
})();
