'use strict';

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ['shorts', 'videos'];
const PLOT_HEIGHT = 84; // keep in sync with .plot in popup.css

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const emptyDay = () => ({
  shorts: { count: 0, seconds: 0 },
  videos: { count: 0, seconds: 0 },
});

function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60) return t('fmtSec', [String(sec)]);
  const mins = Math.floor(sec / 60);
  if (mins < 60) return t('fmtMin', [String(mins)]);
  return t('fmtHM', [String(Math.floor(mins / 60)), String(mins % 60)]);
}

const totalSeconds = (d) => d.shorts.seconds + d.videos.seconds;

// Fill in anything missing so older or partial records never break rendering.
function normalize(raw) {
  const d = emptyDay();
  if (!raw) return d;
  for (const type of TYPES) {
    d[type].count = (raw[type] && raw[type].count) || 0;
    d[type].seconds = (raw[type] && raw[type].seconds) || 0;
  }
  return d;
}

function lastNDays(n) {
  const now = new Date();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  }
  return days;
}

function renderToday(all) {
  const now = new Date();
  const today = normalize(all[dayKey(now)]);
  const total = totalSeconds(today);
  const lang = chrome.i18n.getUILanguage();

  document.getElementById('date').textContent = new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(now);

  const nothing = total === 0 && today.shorts.count === 0 && today.videos.count === 0;
  document.getElementById('headline').textContent = nothing
    ? t('noData')
    : t('headline', [fmtDuration(total)]);

  for (const type of TYPES) {
    const d = today[type];
    document.getElementById(`${type}-value`).textContent =
      `${d.count} · ${fmtDuration(d.seconds)}`;
    const share = total > 0 ? (d.seconds / total) * 100 : 0;
    document.getElementById(`${type}-bar`).style.width = `${share}%`;
  }
}

function renderWeek(all) {
  const lang = chrome.i18n.getUILanguage();
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  const longDay = new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', weekday: 'short' });
  const todayKey = dayKey(new Date());

  const days = lastNDays(7).map((date) => {
    const data = normalize(all[dayKey(date)]);
    return { date, key: dayKey(date), data, total: totalSeconds(data) };
  });
  const max = Math.max(...days.map((d) => d.total), 0);

  const chart = document.getElementById('chart');
  chart.replaceChildren();

  for (const day of days) {
    const col = document.createElement('div');
    col.className = 'col' + (day.key === todayKey ? ' today' : '');
    const label = `${longDay.format(day.date)}: ${fmtDuration(day.total)}`;
    col.title = label;
    col.setAttribute('aria-label', label);

    const plot = document.createElement('div');
    plot.className = 'plot';
    const stack = document.createElement('div');
    stack.className = 'stack';

    if (day.total === 0) {
      stack.classList.add('empty');
    } else {
      stack.style.height = `${Math.max(2, Math.round((day.total / max) * PLOT_HEIGHT))}px`;
      for (const type of TYPES) {
        const seconds = day.data[type].seconds;
        if (seconds <= 0) continue;
        const seg = document.createElement('div');
        seg.className = `seg seg-${type}`;
        seg.style.flexGrow = String(seconds);
        stack.appendChild(seg);
      }
    }
    plot.appendChild(stack);

    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = weekday.format(day.date);

    col.append(plot, lbl);
    chart.appendChild(col);
  }

  const worst = document.getElementById('worst');
  if (max > 0) {
    const top = days.reduce((a, b) => (b.total > a.total ? b : a));
    worst.textContent = t('worstDay', [weekday.format(top.date), fmtDuration(top.total)]);
  } else {
    worst.textContent = '';
  }
}

async function render() {
  const all = await chrome.storage.local.get(null);
  // Keep only YYYY-MM-DD keys so other data could live in storage later.
  const days = {};
  for (const key of Object.keys(all)) {
    if (DAY_RE.test(key)) days[key] = all[key];
  }
  renderToday(days);
  renderWeek(days);
}

function localize() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  document.title = t('extName');
}

document.getElementById('clear').addEventListener('click', async () => {
  if (!confirm(t('confirmClear'))) return;
  await chrome.storage.local.clear();
  render();
});

// Live update while the popup is open and a video is playing in another tab.
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') render();
});

localize();
render();
