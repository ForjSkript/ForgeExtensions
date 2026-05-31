'use strict';

/* ── Constants ───────────────────────────────────────────────────────────── */
const RAW_BASE    = 'https://raw.githubusercontent.com/ForjSkript/ForgeExtensions/refs/heads/main/';
const LIST_URL    = RAW_BASE + 'extensions/list.json';
const GH_API      = 'https://api.github.com/repos/';
const CACHE_TTL   = 5 * 60 * 1000;
const BYPASS      = new URLSearchParams(location.search).has('c');
const VALID_TABS  = ['home', 'readme', 'functions', 'github'];
const DEFAULT_TAB = 'home';

const TYPE_LABEL  = ['Official', 'Community', 'Unlisted'];
const TYPE_COLOR  = ['var(--official)', 'var(--community)', 'var(--unlisted)'];
const TYPE_BADGE  = ['badge-official', 'badge-community', 'badge-unlisted'];

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
async function cachedFetchText(url) {
  const key = 'forj-txt:' + url;
  const hit = cacheGet(key);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  cacheSet(key, text);
  return text;
}

/* ── Utils ───────────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function svg(d, w=14, h=14) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}
function fmtNum(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

const ICON_GH  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58 0-.28-.01-1.02-.01-2-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.32-1.75-1.32-1.75-1.08-.74.08-.72.08-.72 1.2.08 1.82 1.23 1.82 1.23 1.07 1.83 2.8 1.3 3.48 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>`;
const ICON_NPM = `<svg width="15" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M0 7.3v9.4h6.7v1.6h5.3v-1.6H24V7.3H0zm6.7 8H5.3V9.9H4v5.4H1.3V8.6h5.4v6.7zm6.6 1.6h-2.6v-1.6h-1.4V9.9h4V16.9zm9.4-1.6h-1.4v5.4h-2.6V9.9H16v5.4h-1.3V8.6h6.6v6.7z"/></svg>`;
const ICON_DOC = svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>');

/* ── URL params ──────────────────────────────────────────────────────────── */
function getParams() {
  const p   = new URLSearchParams(location.search);
  const id  = p.get('id') ?? '';
  const raw = (p.get('tab') ?? DEFAULT_TAB).toLowerCase();
  const tab = VALID_TABS.includes(raw) ? raw : DEFAULT_TAB;
  // ?function= redirect target
  const fnTarget = p.get('function') ?? p.get('fn') ?? null;
  return { id, tab, fnTarget };
}

function setTab(tab) {
  const p = new URLSearchParams(location.search);
  p.set('tab', tab);
  history.replaceState(null, '', '?' + p.toString());
  activateTab(tab);
}

function activateTab(tab) {
  document.querySelectorAll('.tab').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-panel').forEach(el =>
    el.classList.toggle('active', el.dataset.panel === tab)
  );
}

/* ── Home tab ────────────────────────────────────────────────────────────── */
function buildHomeTab(ext, type) {
  const pkg    = ext.package;
  const gh     = ext.github;
  const author = pkg.author;
  const lead   = pkg.leadDeveloper;
  const ghUrl  = gh ? `https://github.com/${gh.owner}/${gh.repo}` : null;

  const people = [];
  if (author) people.push({ ...author, role: 'Author' });
  if (lead && lead.name !== author?.name) people.push({ ...lead, role: 'Lead Developer' });

  const peopleHTML = people.map(p => `
    <a class="person" href="https://github.com/${esc(p.name)}" target="_blank" rel="noopener">
      <img src="${esc(p.avatar)}" alt="${esc(p.name)}" loading="lazy" />
      <div class="person-info">
        <div class="person-name">${esc(p.name)}</div>
        <div class="person-role">${esc(p.role)}</div>
      </div>
      <div class="person-gh">${ICON_GH}</div>
    </a>`).join('');

  const pkgRows = [
    ['ID',      `<span style="font-family:var(--mono);font-size:12px">${esc(ext.id)}</span>`],
    ['Type',    `<span style="color:${TYPE_COLOR[type]}">${esc(TYPE_LABEL[type] ?? 'Unknown')}</span>`],
    ['Version', pkg.version ? `<span style="font-family:var(--mono)">v${esc(pkg.version)}</span>` : '<span style="color:var(--muted)">—</span>'],
  ].map(([l, v]) => `
    <div class="row">
      <span class="row-label">${l}</span>
      <span class="row-value">${v}</span>
    </div>`).join('');

  const branchHTML = gh?.branches?.length
    ? gh.branches.map(b =>
        `<span class="branch-pill${b === gh.defaultBranch ? ' default' : ''}">${esc(b)}</span>`
      ).join('')
    : '<span style="color:var(--muted);font-size:12px">—</span>';

  const ghRows = gh ? [
    ['Repository', ghUrl ? `<a href="${esc(ghUrl)}" target="_blank" rel="noopener">${esc(gh.owner)}/${esc(gh.repo)}</a>` : '—'],
    ['Default branch', `<span style="font-family:var(--mono);font-size:12px">${esc(gh.defaultBranch ?? '—')}</span>`],
    ['Branches', `<div class="branch-list">${branchHTML}</div>`],
  ].map(([l, v]) => `
    <div class="row">
      <span class="row-label">${l}</span>
      <span class="row-value">${v}</span>
    </div>`).join('') : '';

  return `
    ${people.length ? `
    <div class="section">
      <div class="section-header">${svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')} People</div>
      ${peopleHTML}
    </div>` : ''}
    <div class="section">
      <div class="section-header">${svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>')} Package</div>
      <div class="section-body">${pkgRows}</div>
    </div>
    ${gh ? `
    <div class="section">
      <div class="section-header">${ICON_GH} GitHub</div>
      <div class="section-body">${ghRows}</div>
    </div>` : ''}
  `;
}

/* ── Readme tab ──────────────────────────────────────────────────────────── */
function buildReadmeTab() {
  return `<div class="spinner-wrap"><div class="spinner"></div><span>Loading readme…</span></div>`;
}

async function loadReadme(gh) {
  const panel = document.querySelector('[data-panel="readme"]');
  if (!panel) return;

  if (!gh?.owner || !gh?.repo) {
    panel.innerHTML = `<div class="panel-empty">No GitHub repository linked.</div>`;
    return;
  }

  const branch   = gh.defaultBranch ?? 'main';
  const rawBase  = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/refs/heads/${branch}/`;
  const names    = ['README.md','readme.md','Readme.md','README.MD','README','readme','README.txt','readme.txt'];

  let md = null;
  for (const f of names) {
    try { md = await cachedFetchText(rawBase + f); break; } catch {}
  }

  if (!md) { panel.innerHTML = `<div class="panel-empty">No README found.</div>`; return; }

  // Resolve relative URLs
  md = md
    .replace(/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
      (_, alt, src) => `![${alt}](${rawBase}${src})`)
    .replace(/\[([^\]]*)\]\((?!https?:\/\/)(?!#)([^)]+)\)/g,
      (_, text, href) => `[${text}](https://github.com/${gh.owner}/${gh.repo}/blob/${branch}/${href})`);

  marked.use({ gfm: true, breaks: false });

  const dirty = marked.parse(md);
  const clean = DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });

  panel.innerHTML = `<div class="readme-body">${clean}</div>`;

  // Syntax highlighting + copy buttons on code blocks
  panel.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);

    const pre  = block.parentElement;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = `${svg('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',12,12)} Copy`;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(block.textContent);
        btn.classList.add('copied');
        btn.innerHTML = `${svg('<polyline points="20 6 9 17 4 12"/>',12,12)} Copied`;
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `${svg('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',12,12)} Copy`;
        }, 1800);
      } catch {}
    });
    wrap.appendChild(btn);
  });
}

/* ── Functions tab ───────────────────────────────────────────────────────── */
function buildFunctionsTab() {
  return `<div class="spinner-wrap"><div class="spinner"></div><span>Loading functions…</span></div>`;
}

function fnPerPage() { return window.innerWidth >= 640 ? 25 : 12; }

async function loadFunctions(gh, fnTarget) {
  const panel = document.querySelector('[data-panel="functions"]');
  if (!panel) return;

  if (!gh?.owner || !gh?.repo) {
    panel.innerHTML = `<div class="panel-empty">No GitHub repository linked.</div>`; return;
  }

  const branch = gh.defaultBranch ?? gh.branches?.[0] ?? 'main';
  const url    = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/refs/heads/${branch}/metadata/functions.json`;

  let allFunctions;
  try {
    allFunctions = await cachedFetch(url);
  } catch {
    panel.innerHTML = `<div class="panel-empty">No functions data found for this extension.</div>`; return;
  }

  if (!Array.isArray(allFunctions) || !allFunctions.length) {
    panel.innerHTML = `<div class="panel-empty">No functions found.</div>`; return;
  }

  let query       = '';
  let page        = 0;
  let expandedIdx = null;

  // ?function= redirect — pre-search and expand matching function
  if (fnTarget) {
    query = fnTarget;
    const idx = allFunctions.findIndex(fn =>
      fn.name?.toLowerCase() === fnTarget.toLowerCase() ||
      fn.aliases?.some(a => a.toLowerCase() === fnTarget.toLowerCase())
    );
    if (idx !== -1) {
      const perPage = fnPerPage();
      page = Math.floor(idx / perPage);
      expandedIdx = idx;
    }
  }

  function filtered() {
    if (!query) return allFunctions;
    const q = query.toLowerCase();
    return allFunctions.filter(fn =>
      fn.name?.toLowerCase().includes(q) ||
      fn.description?.toLowerCase().includes(q) ||
      fn.category?.toLowerCase().includes(q) ||
      fn.aliases?.some(a => a.toLowerCase().includes(q))
    );
  }

  function renderFunctions() {
    const list    = filtered();
    const perPage = fnPerPage();
    const pages   = Math.max(1, Math.ceil(list.length / perPage));
    page          = Math.min(page, pages - 1);
    const slice   = list.slice(page * perPage, (page + 1) * perPage);

    let html = `
      <div class="fn-toolbar">
        <div class="fn-search-wrap">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="fn-search" class="fn-search" type="text" placeholder="Search functions…" value="${esc(query)}" autocomplete="off" spellcheck="false" />
        </div>
        <span class="fn-count">${list.length} of ${allFunctions.length}</span>
      </div>
      <div class="fn-list">`;

    if (!slice.length) {
      html += `<div class="fn-empty">No functions match your search.</div>`;
    } else {
      slice.forEach((fn, i) => {
        const globalIdx = page * perPage + i;
        const isOpen    = expandedIdx === globalIdx;
        const reqArgs   = fn.args?.filter(a => a.required !== false) ?? [];
        const optArgs   = fn.args?.filter(a => a.required === false) ?? [];
        const sig = fn.brackets !== false
          ? `${esc(fn.name)}[${[...reqArgs.map(a => esc(a.name)), ...optArgs.map(a => esc(a.name)+'?')].join('; ')}]`
          : esc(fn.name);

        html += `
          <div class="fn-row${isOpen ? ' fn-open' : ''}" data-fn-idx="${globalIdx}">
            <div class="fn-summary">
              <div class="fn-summary-left">
                <code class="fn-name">${esc(fn.name)}</code>
                ${fn.category ? `<span class="fn-cat">${esc(fn.category)}</span>` : ''}
                ${fn.output?.length ? fn.output.map(o => `<span class="fn-returns">${esc(o)}</span>`).join('') : ''}
              </div>
              <svg class="fn-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            ${isOpen ? `
            <div class="fn-detail">
              ${fn.description ? `<p class="fn-desc">${esc(fn.description)}</p>` : ''}
              <code class="fn-usage">${sig}</code>
              ${fn.aliases?.length ? `
                <div class="fn-detail-row">
                  <span class="fn-detail-label">Aliases</span>
                  <div class="fn-aliases">${fn.aliases.map(a => `<code class="fn-alias">${esc(a)}</code>`).join('')}</div>
                </div>` : ''}
              ${fn.version ? `
                <div class="fn-detail-row">
                  <span class="fn-detail-label">Since</span>
                  <span class="fn-detail-val" style="font-family:var(--mono)">v${esc(fn.version)}</span>
                </div>` : ''}
              ${fn.args?.length ? `
                <div class="fn-detail-row fn-detail-col">
                  <span class="fn-detail-label">Arguments</span>
                  <div class="fn-args-table">
                    ${fn.args.map(a => `
                      <div class="fn-arg-row">
                        <code class="fn-arg-name">${esc(a.name)}</code>
                        <span class="fn-arg-type ${a.required === false ? 'optional' : 'required'}">${esc(a.type ?? '?')}${a.required === false ? '?' : ''}</span>
                        ${a.rest ? `<span class="fn-arg-rest">…rest</span>` : ''}
                        ${a.description ? `<span class="fn-arg-desc">${esc(a.description)}</span>` : ''}
                        ${a.enum?.length ? `<div class="fn-arg-enum">${a.enum.map(e => `<code>${esc(e)}</code>`).join('')}</div>` : ''}
                      </div>`).join('')}
                  </div>
                </div>` : ''}
            </div>` : ''}
          </div>`;
      });
    }

    html += `</div>`;

    // Pagination
    if (pages > 1) {
      html += `<div class="pagination">
        <button class="page-btn" data-dir="-1" ${page === 0 ? 'disabled' : ''}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span class="page-info">${page + 1} / ${pages}</span>
        <button class="page-btn" data-dir="1" ${page >= pages - 1 ? 'disabled' : ''}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>`;
    }

    panel.innerHTML = html;

    const searchEl = panel.querySelector('#fn-search');
    if (searchEl) {
      searchEl.focus();
      searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
      searchEl.addEventListener('input', e => {
        query = e.target.value; page = 0; expandedIdx = null; renderFunctions();
      });
    }

    panel.querySelectorAll('.fn-row').forEach(row => {
      row.querySelector('.fn-summary').addEventListener('click', () => {
        const idx = +row.dataset.fnIdx;
        expandedIdx = expandedIdx === idx ? null : idx;
        renderFunctions();
      });
    });

    panel.querySelectorAll('.page-btn').forEach(btn => {
      if (btn.dataset.dir) {
        btn.addEventListener('click', () => {
          page += +btn.dataset.dir; expandedIdx = null; renderFunctions();
        });
      }
    });

    // Scroll to expanded function if redirected
    if (fnTarget && expandedIdx !== null) {
      const openRow = panel.querySelector('.fn-row.fn-open');
      if (openRow) setTimeout(() => openRow.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }

  renderFunctions();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderFunctions, 150);
  }, { passive: true });
}

/* ── GitHub tab ──────────────────────────────────────────────────────────── */
function buildGithubTab() {
  return `<div class="spinner-wrap"><div class="spinner"></div><span>Loading GitHub info…</span></div>`;
}

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', 'C#': '#178600', 'C++': '#f34b7d', Go: '#00ADD8',
  Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95', HTML: '#e34c26',
  CSS: '#563d7c', Shell: '#89e051', Markdown: '#083fa1',
};

async function loadGithub(gh) {
  const panel = document.querySelector('[data-panel="github"]');
  if (!panel) return;

  if (!gh?.owner || !gh?.repo) {
    panel.innerHTML = `<div class="panel-empty">No GitHub repository linked.</div>`; return;
  }

  const base = `${GH_API}${gh.owner}/${gh.repo}`;

  try {
    const [repo, contributors, langs] = await Promise.allSettled([
      cachedFetch(base),
      cachedFetch(base + '/contributors?per_page=20&anon=false'),
      cachedFetch(base + '/languages'),
    ]);

    const r = repo.status === 'fulfilled' ? repo.value : null;
    const c = contributors.status === 'fulfilled' ? contributors.value : [];
    const l = langs.status === 'fulfilled' ? langs.value : {};

    let html = '';

    // Stats grid
    if (r) {
      const stats = [
        ['Stars',      '⭐', fmtNum(r.stargazers_count)],
        ['Forks',      '🍴', fmtNum(r.forks_count)],
        ['Watchers',   '👁️', fmtNum(r.watchers_count)],
        ['Issues',     '🐛', fmtNum(r.open_issues_count)],
      ];
      html += `<div class="gh-stats">`;
      stats.forEach(([label, icon, val]) => {
        html += `<div class="gh-stat">
          <div class="gh-stat-val">${icon} ${val}</div>
          <div class="gh-stat-label">${label}</div>
        </div>`;
      });
      html += `</div>`;

      // Repo info rows
      const license = r.license?.spdx_id ?? '—';
      const updated = r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : '—';
      const created = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : '—';
      const rows = [
        ['Description', esc(r.description ?? '—')],
        ['License',     esc(license)],
        ['Created',     created],
        ['Updated',     updated],
        ['Default branch', `<span style="font-family:var(--mono)">${esc(r.default_branch)}</span>`],
        ['Topics', r.topics?.length
          ? r.topics.map(t => `<span style="font-family:var(--mono);font-size:11px;padding:2px 7px;border:1px solid var(--border);border-radius:4px;color:var(--community)">${esc(t)}</span>`).join(' ')
          : '—'],
      ].map(([l, v]) => `<div class="row"><span class="row-label">${l}</span><span class="row-value">${v}</span></div>`).join('');

      html += `<div class="section">
        <div class="section-header">${ICON_GH} Repository</div>
        <div class="section-body">${rows}</div>
      </div>`;
    }

    // Languages bar
    const totalBytes = Object.values(l).reduce((s, v) => s + v, 0);
    if (totalBytes > 0) {
      const langEntries = Object.entries(l).sort((a, b) => b[1] - a[1]);
      const barSegs = langEntries.map(([name, bytes]) => {
        const pct = ((bytes / totalBytes) * 100).toFixed(1);
        const col = LANG_COLORS[name] || '#888';
        return `<div class="lang-seg" style="flex:${pct};background:${col}" title="${name} ${pct}%"></div>`;
      }).join('');
      const langItems = langEntries.map(([name, bytes]) => {
        const pct = ((bytes / totalBytes) * 100).toFixed(1);
        const col = LANG_COLORS[name] || '#888';
        return `<div class="lang-item"><span class="lang-dot" style="background:${col}"></span><span class="lang-name">${esc(name)}</span><span style="color:var(--muted)">${pct}%</span></div>`;
      }).join('');

      html += `<div class="section">
        <div class="section-header">${svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>')} Languages</div>
        <div style="padding:16px">
          <div class="lang-bar">${barSegs}</div>
          <div class="lang-list">${langItems}</div>
        </div>
      </div>`;
    }

    // Contributors
    if (Array.isArray(c) && c.length) {
      const contribHTML = c.map(u => `
        <a class="contrib" href="${esc(u.html_url)}" target="_blank" rel="noopener">
          <img src="${esc(u.avatar_url)}&s=52" alt="${esc(u.login)}" loading="lazy" />
          <span class="contrib-name">${esc(u.login)}</span>
          <span class="contrib-commits">${fmtNum(u.contributions)}</span>
        </a>`).join('');

      html += `<div class="section">
        <div class="section-header">${svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')} Contributors</div>
        <div class="contributors">${contribHTML}</div>
      </div>`;
    }

    if (!html) html = `<div class="panel-empty">No GitHub data available.</div>`;
    panel.innerHTML = html;

  } catch (err) {
    panel.innerHTML = `<div class="panel-empty">Failed to load GitHub data. GitHub API may be rate-limited.</div>`;
  }
}

/* ── Render error ────────────────────────────────────────────────────────── */
function renderError(msg) {
  document.getElementById('root').innerHTML = `
    <div class="state">
      <div class="icon">⌀</div>
      <p>${esc(msg)}</p>
      <p style="margin-top:10px"><a href="index.html">← All extensions</a></p>
    </div>`;
}

/* ── Render page ─────────────────────────────────────────────────────────── */
function renderPage(ext, type, activeTab) {
  const pkg   = ext.package;
  const gh    = ext.github;
  const links = ext.links ?? {};
  const author = pkg.author;
  const lead   = pkg.leadDeveloper;
  const ghUrl  = gh ? `https://github.com/${gh.owner}/${gh.repo}` : null;

  document.title = `${pkg.name} — ForgeExtensions`;

  // Avatar
  const avatarHTML = author?.avatar
    ? `<img src="${esc(author.avatar)}" alt="${esc(author.name)}" />`
    : `<div class="ph">📦</div>`;
  const pipHTML = lead?.avatar && lead.avatar !== author?.avatar
    ? `<img class="pip" src="${esc(lead.avatar)}" alt="${esc(lead.name)}" />`
    : '';

  // Buttons
  const btns = [];
  if (ghUrl)               btns.push([ghUrl,               ICON_GH,  'GitHub',        false]);
  if (links.npm)           btns.push([links.npm,           ICON_NPM, 'npm',           false]);
  if (links.documentation) btns.push([links.documentation, ICON_DOC, 'Docs',          true ]);

  const btnsHTML = btns.map(([href, icon, label, primary]) =>
    `<a href="${esc(href)}" target="_blank" rel="noopener" class="btn${primary ? ' btn-primary' : ''}">${icon} ${label}</a>`
  ).join('');

  const tabDefs = [
    { id: 'home',      icon: svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'), label: 'Overview' },
    { id: 'readme',    icon: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'), label: 'Readme' },
    { id: 'functions', icon: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'), label: 'Functions' },
    { id: 'github',    icon: ICON_GH, label: 'GitHub' },
  ];

  const tabsHTML = tabDefs.map(t =>
    `<button class="tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.icon} ${t.label}</button>`
  ).join('');

  const panels = {
    home:      buildHomeTab(ext, type),
    readme:    buildReadmeTab(),
    functions: buildFunctionsTab(),
    github:    buildGithubTab(),
  };

  const panelsHTML = Object.entries(panels).map(([id, html]) =>
    `<div class="tab-panel${id === activeTab ? ' active' : ''}" data-panel="${id}">${html}</div>`
  ).join('');

  document.getElementById('root').innerHTML = `
    <div class="hero">
      <div class="hero-avatar">${avatarHTML}${pipHTML}</div>
      <div class="hero-text">
        <div class="hero-badges">
          <span class="badge ${TYPE_BADGE[type]}">${esc(TYPE_LABEL[type] ?? 'Unknown')}</span>
        </div>
        <h1>${esc(pkg.name)}</h1>
        <div class="pkg-id">${esc(ext.id)}</div>
        <p class="desc">${esc(pkg.description)}</p>
      </div>
    </div>

    ${btnsHTML ? `<div class="links">${btnsHTML}</div>` : ''}

    <nav class="tabs">${tabsHTML}</nav>

    <div id="panels">${panelsHTML}</div>
  `;
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
async function main() {
  const { id, tab, fnTarget } = getParams();

  if (!id) { renderError('No extension ID provided. Use ?id=@scope/name'); return; }

  let list;
  try { list = await cachedFetch(LIST_URL); }
  catch { renderError('Failed to load extension list.'); return; }

  const entry = list.find(e => e.id === id);
  if (!entry) { renderError(`Extension "${id}" not found.`); return; }

  const type = entry.file.includes('/official/') ? 0 : entry.file.includes('/community/') ? 1 : 2;

  let ext;
  try { ext = await cachedFetch(RAW_BASE + entry.file); }
  catch { renderError(`Failed to load extension data for "${id}".`); return; }

  // If ?function= is set, open functions tab automatically
  const resolvedTab = fnTarget ? 'functions' : tab;

  renderPage(ext, type, resolvedTab);

  let readmeLoaded    = false;
  let functionsLoaded = false;
  let githubLoaded    = false;

  async function ensureReadme()    { if (readmeLoaded)    return; readmeLoaded    = true; await loadReadme(ext.github); }
  async function ensureFunctions() { if (functionsLoaded) return; functionsLoaded = true; await loadFunctions(ext.github, fnTarget); }
  async function ensureGithub()    { if (githubLoaded)    return; githubLoaded    = true; await loadGithub(ext.github); }

  // Trigger active tab's loader immediately
  if (resolvedTab === 'readme')    ensureReadme();
  if (resolvedTab === 'functions') ensureFunctions();
  if (resolvedTab === 'github')    ensureGithub();

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setTab(btn.dataset.tab);
      if (btn.dataset.tab === 'readme')    ensureReadme();
      if (btn.dataset.tab === 'functions') ensureFunctions();
      if (btn.dataset.tab === 'github')    ensureGithub();
    });
  });
}

main();
