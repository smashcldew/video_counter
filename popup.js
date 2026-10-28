'use strict';

const { TYPES, localDay, migrateDay, labelKey } = VC;
const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLOT_HEIGHT = 84; // keep in sync with .plot in popup.css

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60) return t('fmtSec', [String(sec)]);
  const mins = Math.floor(sec / 60);
  if (mins < 60) return t('fmtMin', [String(mins)]);
  return t('fmtHM', [String(Math.floor(mins / 60)), String(mins % 60)]);
}

const secondsOf = (day, id) => (day[id] && day[id].seconds) || 0;
const countOf = (day, id) => (day[id] && day[id].count) || 0;
const totalSeconds = (day) => TYPES.reduce((sum, ty) => sum + secondsOf(day, ty.id), 0);

function lastNDays(n) {
  const now = new Date();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  }
  return days;
}

// Only show types that have activity in the chart's window, so someone who never
// opens Instagram never sees a Reels row.
function visibleTypes(days) {
  const window = lastNDays(7).map((d) => days[localDay(d)] || {});
  return TYPES.filter((ty) => window.some((day) => countOf(day, ty.id) || secondsOf(day, ty.id)));
}

function renderToday(days, visible) {
  const now = new Date();
  const today = days[localDay(now)] || {};
  const total = totalSeconds(today);
  const lang = chrome.i18n.getUILanguage();

  document.getElementById('date').textContent = new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(now);

  const nothing = total === 0 && TYPES.every((ty) => countOf(today, ty.id) === 0);
  document.getElementById('headline').textContent = nothing
    ? t('noData')
    : t('headline', [fmtDuration(total)]);

  const rows = document.getElementById('rows');
  rows.replaceChildren();
  for (const ty of visible) {
    const seconds = secondsOf(today, ty.id);

    const row = el('div', 'row');
    const top = el('div', 'row-top');
    const dot = el('span', 'dot');
    dot.style.background = `var(${ty.color})`;
    top.append(
      dot,
      el('span', 'row-name', t(labelKey(ty.id))),
      el('span', 'row-value', `${countOf(today, ty.id)} · ${fmtDuration(seconds)}`),
    );

    const track = el('div', 'track');
    const fill = el('div', 'fill');
    fill.style.background = `var(${ty.color})`;
    fill.style.width = `${total > 0 ? (seconds / total) * 100 : 0}%`;
    track.appendChild(fill);

    row.append(top, track);
    rows.appendChild(row);
  }
}

function renderWeek(days, visible) {
  const lang = chrome.i18n.getUILanguage();
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  const longDay = new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', weekday: 'short' });
  const todayKey = localDay();

  const week = lastNDays(7).map((date) => {
    const data = days[localDay(date)] || {};
    return { date, key: localDay(date), data, total: totalSeconds(data) };
  });
  const max = Math.max(...week.map((d) => d.total), 0);

  const chart = document.getElementById('chart');
  chart.replaceChildren();

  for (const day of week) {
    const col = el('div', 'col' + (day.key === todayKey ? ' today' : ''));
    const label = `${longDay.format(day.date)}: ${fmtDuration(day.total)}`;
    col.title = label;
    col.setAttribute('aria-label', label);

    const plot = el('div', 'plot');
    const stack = el('div', 'stack');

    if (day.total === 0) {
      stack.classList.add('empty');
    } else {
      stack.style.height = `${Math.max(2, Math.round((day.total / max) * PLOT_HEIGHT))}px`;
      for (const ty of visible) {
        const seconds = secondsOf(day.data, ty.id);
        if (seconds <= 0) continue;
        const seg = el('div', 'seg');
        seg.style.background = `var(${ty.color})`;
        seg.style.flexGrow = String(seconds);
        stack.appendChild(seg);
      }
    }
    plot.appendChild(stack);

    col.append(plot, el('div', 'lbl', weekday.format(day.date)));
    chart.appendChild(col);
  }

  const worst = document.getElementById('worst');
  if (max > 0) {
    const top = week.reduce((a, b) => (b.total > a.total ? b : a));
    worst.textContent = t('worstDay', [weekday.format(top.date), fmtDuration(top.total)]);
  } else {
    worst.textContent = '';
  }
}

async function render() {
  const all = await chrome.storage.local.get(null);
  // Keep only YYYY-MM-DD keys (so other data could live in storage later) and
  // convert any 0.1-format records on the way in.
  const days = {};
  for (const key of Object.keys(all)) {
    if (DAY_RE.test(key)) days[key] = migrateDay(all[key]);
  }
  const visible = visibleTypes(days);
  renderToday(days, visible);
  renderWeek(days, visible);
}

function localize() {
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
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
