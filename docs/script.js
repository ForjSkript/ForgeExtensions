"use strict";

/* ── Constants ───────────────────────────────────────────────────────────── */
const RAW_BASE   = 'https://raw.githubusercontent.com/ForjSkript/ForgeExtensions/refs/heads/main/';
const LIST_URL   = RAW_BASE + 'extensions/list.json';
const CACHE_TTL  = 5 * 60 * 1000;
const BYPASS     = new URLSearchParams(location.search).has('c');
const PER_PAGE   = 15;
const DEBOUNCE   = 160;

const TYPE_LABELS  = ['official', 'community', 'unlisted'];
const TYPE_DISPLAY = ['Official', 'Community', 'Unlisted'];
const TYPE_BADGE   = ['badge-official', 'badge-community', 'badge-unlisted'];
const TYPE_ICONS   = ['🔧', '🌐', '🔒'];

/* ── State ───────────────────────────────────────────────────────────────── */
let allExtensions = [];
let activeFilter  = 'all';
let activeSort    = 'name-asc';
let searchQuery   = '';
let currentPage   = 0;
let searchTimer   = null;

/* ── Theme ───────────────────────────────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('forge-theme') || 'dark';
  applyTheme(saved);
})();

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('forge-theme', t);
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.querySelector('.icon-sun').style.display  = t === 'dark'  ? '' : 'none';
  btn.querySelector('.icon-moon').style.display = t === 'light' ? '' : 'none';
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

/* ── Cache ───────────────────────────────────────────────────────────────── */
function cacheGet(key) {
  if (BYPASS) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

async function cachedFetch(url) {
  const key = 'forj:' + url;
  const hit = cacheGet(key);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  cacheSet(key, data);
  return data;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function typeFromFile(f) {
  return f.includes('/official/') ? 0 : f.includes('/community/') ? 1 : 2;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Fetch & boot ────────────────────────────────────────────────────────── */
async function loadExtensions() {
  try {
    const data = await cachedFetch(LIST_URL);
    allExtensions = data.map(e => ({ ...e, type: typeFromFile(e.file), _meta: null }));
    render();
    // Fetch meta progressively, patch visible cards
    allExtensions.forEach((e, i) => fetchMeta(e, i));
  } catch (err) {
    console.error(err);
    document.getElementById('empty').innerHTML =
      '<div class="empty-icon">⚠️</div>Failed to load extensions. Try again.';
    document.getElementById('empty').style.display = 'block';
  }
}

async function fetchMeta(ext, i) {
  try {
    const meta = await cachedFetch(RAW_BASE + ext.file);
    allExtensions[i]._meta = meta;
    const card = document.querySelector(`.card[data-id="${CSS.escape(ext.id)}"]`);
    if (card) patchCard(card, meta, ext.type);
  } catch {}
}

/* ── Filtering / sorting ─────────────────────────────────────────────────── */
function filtered() {
  return allExtensions.filter(e => {
    const okT = activeFilter === 'all' || TYPE_LABELS[e.type] === activeFilter;
    const q   = searchQuery.toLowerCase();
    const okQ = !q || [e.name, e.description, e.id].some(s => s?.toLowerCase().includes(q));
    return okT && okQ;
  }).sort((a, b) => {
    if (activeSort === 'name-asc')  return a.name.localeCompare(b.name);
    if (activeSort === 'name-desc') return b.name.localeCompare(a.name);
    if (activeSort === 'type-asc')  return a.type - b.type || a.name.localeCompare(b.name);
    if (activeSort === 'type-desc') return b.type - a.type || a.name.localeCompare(b.name);
    return 0;
  });
}

/* ── Render ──────────────────────────────────────────────────────────────── */
function render() {
  const list    = filtered();
  const pages   = Math.max(1, Math.ceil(list.length / PER_PAGE));
  currentPage   = Math.min(currentPage, pages - 1);
  const slice   = list.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE);

  const container = document.getElementById('extensions');
  const empty     = document.getElementById('empty');

  // Remove old cards
  container.querySelectorAll('.card').forEach(c => c.remove());

  if (!slice.length) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    const frag = document.createDocumentFragment();
    slice.forEach((ext, sliceIdx) => {
      const card = buildCard(ext);
      card.style.animationDelay = `${sliceIdx * 22}ms`;
      if (ext._meta) patchCard(card, ext._meta, ext.type);
      frag.appendChild(card);
    });
    container.appendChild(frag);
  }

  // Stats
  const by = [0,1,2].map(t => allExtensions.filter(e => e.type === t).length);
  const countEl = document.getElementById('count-display');
  countEl.innerHTML =
    `<span>${list.length} of ${allExtensions.length} extensions</span>` +
    `<span class="sep">|</span>` +
    `<span style="color:var(--official)">${by[0]} official</span>` +
    `<span style="color:var(--community)">${by[1]} community</span>` +
    `<span style="color:var(--unlisted)">${by[2]} unlisted</span>`;

  // Pagination
  renderPagination(pages);
}

function renderPagination(pages) {
  const wrap = document.getElementById('pagination-wrap');
  if (pages <= 1) { wrap.innerHTML = ''; return; }

  const MAX_BTNS = 7;
  let html = `<div class="pagination">`;
  html += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 0 ? 'disabled' : ''}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
  </button>`;

  // Page numbers with ellipsis
  const nums = [];
  if (pages <= MAX_BTNS) {
    for (let i = 0; i < pages; i++) nums.push(i);
  } else {
    nums.push(0);
    if (currentPage > 3) nums.push('…');
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(pages - 2, currentPage + 1); i++) nums.push(i);
    if (currentPage < pages - 4) nums.push('…');
    nums.push(pages - 1);
  }

  nums.forEach(n => {
    if (n === '…') {
      html += `<span class="page-info">…</span>`;
    } else {
      html += `<button class="page-btn${n === currentPage ? ' active' : ''}" data-page="${n}">${n + 1}</button>`;
    }
  });

  html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage >= pages - 1 ? 'disabled' : ''}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
  </button>`;
  html += `</div>`;

  wrap.innerHTML = html;
  wrap.querySelectorAll('.page-btn:not(:disabled)').forEach(btn => {
    const p = parseInt(btn.dataset.page, 10);
    if (!isNaN(p)) btn.addEventListener('click', () => {
      currentPage = p;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ── Build card ──────────────────────────────────────────────────────────── */
function buildCard(ext) {
  const card = document.createElement('a');
  card.className   = 'card';
  card.href        = `ext.html?id=${encodeURIComponent(ext.id)}`;
  card.dataset.id  = ext.id;
  card.dataset.type = ext.type;
  card.innerHTML = `
    <div class="card-top">
      <div class="avatar-wrap">
        <div class="avatar-stack">
          <div class="card-avatar-ph">${TYPE_ICONS[ext.type]}</div>
        </div>
      </div>
      <div class="card-meta">
        <div class="card-name">${esc(ext.name)}</div>
        <div class="card-id">${esc(ext.id)}</div>
        <div class="branches-wrap"></div>
      </div>
      <span class="badge ${TYPE_BADGE[ext.type]}">${TYPE_DISPLAY[ext.type]}</span>
    </div>
    <p class="card-desc">${esc(ext.description)}</p>
    <div class="card-footer"></div>`;
  return card;
}

function patchCard(card, meta, type) {
  const aAvatar = meta?.package?.author?.avatar;
  const aName   = meta?.package?.author?.name;
  const lAvatar = meta?.package?.leadDeveloper?.avatar;
  const lName   = meta?.package?.leadDeveloper?.name;

  const aw = card.querySelector('.avatar-wrap');
  if (aw) {
    let tipText = aName || '';
    if (lName && lName !== aName) tipText += ` · ${lName}`;
    aw.innerHTML = `
      <div class="avatar-stack has-tip">
        ${aAvatar
          ? `<img class="card-avatar" src="${esc(aAvatar)}" alt="${esc(aName||'')}" loading="lazy" />`
          : `<div class="card-avatar-ph">${TYPE_ICONS[type||0]}</div>`}
        ${lAvatar && lAvatar !== aAvatar
          ? `<img class="avatar-pip" src="${esc(lAvatar)}" alt="${esc(lName||'')}" loading="lazy" />`
          : ''}
        ${tipText ? `<span class="tip">${esc(tipText)}</span>` : ''}
      </div>`;
  }

  const bw = card.querySelector('.branches-wrap');
  const branches = meta?.github?.branches;
  const def      = meta?.github?.defaultBranch;
  if (bw && branches?.length) {
    bw.innerHTML = branches.map(b =>
      `<span class="branch-tag${b === def ? ' default' : ''}">${esc(b)}</span>`
    ).join('');
  }

  const footer = card.querySelector('.card-footer');
  if (footer) {
    footer.innerHTML = `<a href="ext.html?id=${encodeURIComponent(card.dataset.id)}" class="btn btn-primary">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      View
    </a>`;
  }
}

/* ── Events ──────────────────────────────────────────────────────────────── */
document.getElementById('search').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value;
    currentPage = 0;
    render();
  }, DEBOUNCE);
});

document.getElementById('sort').addEventListener('change', e => {
  activeSort  = e.target.value;
  currentPage = 0;
  render();
});

document.querySelectorAll('.pill').forEach(p =>
  p.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    activeFilter = p.dataset.type;
    currentPage  = 0;
    render();
  })
);

/* ── Boot ────────────────────────────────────────────────────────────────── */
loadExtensions();
