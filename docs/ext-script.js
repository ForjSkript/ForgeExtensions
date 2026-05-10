const RAW_BASE  = 'https://raw.githubusercontent.com/ForjSkript/ForgeExtensions/refs/heads/main/';
const LIST_URL  = RAW_BASE + 'extensions/list.json';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

const VALID_TABS  = ['home', 'readme', 'functions'];
const DEFAULT_TAB = 'home';

const TYPE_LABEL  = ['Official', 'Community', 'Unlisted'];
const TYPE_COLOR  = ['var(--official)', 'var(--community)', 'var(--unlisted)'];
const TYPE_BORDER = ['#1a4a28', '#1a2e4a', '#4a2a10'];

/* ── Cache ─────────────────────────────────────────────────────────────── */

function cacheGet(key) {
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
  const key = 'forj-text:' + url;
  const hit = cacheGet(key);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  cacheSet(key, text);
  return text;
}

/* ── Utils ─────────────────────────────────────────────────────────────── */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgIcon(d, w = 13, h = 13) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

const ICON_GH  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58 0-.28-.01-1.02-.01-2-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.32-1.75-1.32-1.75-1.08-.74.08-.72.08-.72 1.2.08 1.82 1.23 1.82 1.23 1.07 1.83 2.8 1.3 3.48 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>`;
const ICON_NPM = `<svg width="15" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M0 7.3v9.4h6.7v1.6h5.3v-1.6H24V7.3H0zm6.7 8H5.3V9.9H4v5.4H1.3V8.6h5.4v6.7zm6.6 1.6h-2.6v-1.6h-1.4V9.9h4V16.9zm9.4-1.6h-1.4v5.4h-2.6V9.9H16v5.4h-1.3V8.6h6.6v6.7z"/></svg>`;
const ICON_DOC = svgIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>');

/* ── URL params ─────────────────────────────────────────────────────────── */

function getParams() {
  const p = new URLSearchParams(location.search);
  const id  = p.get('id') ?? '';
  const raw = (p.get('tab') ?? DEFAULT_TAB).toLowerCase();
  const tab = VALID_TABS.includes(raw) ? raw : DEFAULT_TAB;
  return { id, tab };
}

function setTab(tab) {
  const p = new URLSearchParams(location.search);
  p.set('tab', tab);
  history.replaceState(null, '', '?' + p.toString());
  activateTab(tab);
}

function activateTab(tab) {
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(el => {
    el.classList.toggle('active', el.dataset.panel === tab);
  });
}

/* ── Home tab ───────────────────────────────────────────────────────────── */

function buildHomeTab(ext, type) {
  const pkg    = ext.package;
  const gh     = ext.github;
  const author = pkg.author;
  const lead   = pkg.leadDeveloper;
  const ghUrl  = gh ? `https://github.com/${gh.owner}/${gh.repo}` : null;

  const people = [];
  if (author) people.push({ name: author.name, avatar: author.avatar, role: 'Author' });
  if (lead)   people.push({ name: lead.name,   avatar: lead.avatar,   role: 'Lead Developer' });

  const peopleHTML = people.map(p => `
    <div class="person">
      <img src="${esc(p.avatar)}" alt="${esc(p.name)}" loading="lazy" />
      <div>
        <div class="person-name">${esc(p.name)}</div>
        <div class="person-role">${esc(p.role)}</div>
      </div>
    </div>`).join('');

  const pkgRowsHTML = [
    ['ID',   `<span style="font-size:12px;color:var(--muted)">${esc(ext.id)}</span>`],
    ['Type', `<span style="color:${TYPE_COLOR[type]}">${esc(TYPE_LABEL[type] ?? 'Unknown')}</span>`],
  ].map(([label, value]) => `
    <div class="row">
      <span class="row-label">${label}</span>
      <span class="row-value">${value}</span>
    </div>`).join('');

  const branchHTML = gh?.branches?.length
    ? gh.branches.map(b =>
        `<span class="branch-pill${b === gh.defaultBranch ? ' default' : ''}">${esc(b)}</span>`
      ).join('')
    : '<span style="color:var(--muted);font-size:12px">—</span>';

  const ghRowsHTML = gh ? [
    ['Repository', ghUrl ? `<a href="${esc(ghUrl)}" target="_blank" rel="noopener">${esc(gh.owner)}/${esc(gh.repo)}</a>` : '—'],
    ['Branches',   `<div class="branch-list">${branchHTML}</div>`],
  ].map(([label, value]) => `
    <div class="row">
      <span class="row-label">${label}</span>
      <span class="row-value">${value}</span>
    </div>`).join('') : '';

  return `
    ${people.length ? `
    <div class="section">
      <div class="section-header">${svgIcon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')} People</div>
      <div class="section-body">${peopleHTML}</div>
    </div>` : ''}

    <div class="section">
      <div class="section-header">${svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>')} Package</div>
      <div class="section-body">${pkgRowsHTML}</div>
    </div>

    ${gh ? `
    <div class="section">
      <div class="section-header">${ICON_GH} GitHub</div>
      <div class="section-body">${ghRowsHTML}</div>
    </div>` : ''}
  `;
}

/* ── Readme tab ─────────────────────────────────────────────────────────── */

function buildReadmeTab() {
  return `<div class="readme-loading">
    <div class="readme-spinner"></div>
    <span>Loading readme…</span>
  </div>`;
}

async function loadReadme(gh) {
  const panel = document.querySelector('[data-panel="readme"]');
  if (!panel) return;

  if (!gh?.owner || !gh?.repo) {
    panel.innerHTML = `<div class="readme-empty">No GitHub repository linked.</div>`;
    return;
  }

  const branch  = gh.defaultBranch ?? 'main';
  const rawBase = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/refs/heads/${branch}/`;
  const url     = rawBase + 'README.md';

  let md;
  try {
    md = await cachedFetchText(url);
  } catch {
    panel.innerHTML = `<div class="readme-empty">No README.md found for this extension.</div>`;
    return;
  }

  // Resolve relative image/link URLs to absolute
  md = md
    .replace(/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
      (_, alt, src) => `![${alt}](${rawBase}${src})`)
    .replace(/\[([^\]]*)\]\((?!https?:\/\/)(?!#)([^)]+)\)/g,
      (_, text, href) => `[${text}](https://github.com/${gh.owner}/${gh.repo}/blob/${branch}/${href})`);

  marked.use({ gfm: true, breaks: false });

  // Sanitize rendered HTML with DOMPurify before injecting
  const dirty = marked.parse(md);
  const clean = DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });

  panel.innerHTML = `<div class="readme-body">${clean}</div>`;
}

/* ── Functions tab ──────────────────────────────────────────────────────── */

function buildFunctionsTab() {
  return `<div class="readme-loading">
    <div class="readme-spinner"></div>
    <span>Loading functions…</span>
  </div>`;
}

function fnPerPage() {
  return window.innerWidth >= 640 ? 25 : 10;
}

async function loadFunctions(gh) {
  const panel = document.querySelector('[data-panel="functions"]');
  if (!panel) return;

  if (!gh?.owner || !gh?.repo) {
    panel.innerHTML = `<div class="readme-empty">No GitHub repository linked.</div>`;
    return;
  }

  const branch = gh.defaultBranch ?? gh.branches?.[0] ?? 'main';
  const url    = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/refs/heads/${branch}/metadata/functions.json`;

  let allFunctions;
  try {
    allFunctions = await cachedFetch(url);
  } catch {
    panel.innerHTML = `<div class="readme-empty">Couldn't fetch functions for this extension.</div>`;
    return;
  }

  if (!Array.isArray(allFunctions) || !allFunctions.length) {
    panel.innerHTML = `<div class="readme-empty">No functions found.</div>`;
    return;
  }

  let query       = '';
  let page        = 0;
  let expandedIdx = null;

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
    const slice   = list.slice(page * perPage, page * perPage + perPage);

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
        const optArgs   = fn.args?.filter(a => a.required === false)  ?? [];

        const sig = fn.brackets !== false
          ? `${esc(fn.name)}[${[
              ...reqArgs.map(a => esc(a.name)),
              ...optArgs.map(a => esc(a.name) + '?'),
            ].join('; ')}]`
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

            ${isOpen ? `<div class="fn-detail">
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
                  <span class="fn-detail-val">v${esc(fn.version)}</span>
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

    if (pages > 1) {
      html += `<div class="fn-pagination">
        <button class="fn-page-btn" data-dir="-1" ${page === 0 ? 'disabled' : ''}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span class="fn-page-info">${page + 1} / ${pages}</span>
        <button class="fn-page-btn" data-dir="1" ${page >= pages - 1 ? 'disabled' : ''}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>`;
    }

    panel.innerHTML = html;

    // Search
    const searchEl = panel.querySelector('#fn-search');
    if (searchEl) {
      searchEl.focus();
      searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
      searchEl.addEventListener('input', e => {
        query = e.target.value;
        page  = 0;
        expandedIdx = null;
        renderFunctions();
      });
    }

    // Row expand/collapse
    panel.querySelectorAll('.fn-row').forEach(row => {
      row.querySelector('.fn-summary').addEventListener('click', () => {
        const idx   = +row.dataset.fnIdx;
        expandedIdx = expandedIdx === idx ? null : idx;
        renderFunctions();
      });
    });

    // Pagination
    panel.querySelectorAll('.fn-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        page += +btn.dataset.dir;
        expandedIdx = null;
        renderFunctions();
      });
    });
  }

  renderFunctions();

  // Recalculate page size on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderFunctions(), 150);
  }, { passive: true });
}

/* ── Render ─────────────────────────────────────────────────────────────── */

function renderError(msg) {
  document.getElementById('root').innerHTML = `
    <div class="state">
      <div class="icon">⌀</div>
      <p>${esc(msg)}</p>
      <p style="margin-top:8px"><a href="index.html">← Back to all extensions</a></p>
    </div>`;
}

function renderPage(ext, type, activeTab) {
  const pkg    = ext.package;
  const gh     = ext.github;
  const links  = ext.links ?? {};
  const author = pkg.author;
  const lead   = pkg.leadDeveloper;
  const ghUrl  = gh ? `https://github.com/${gh.owner}/${gh.repo}` : null;

  document.title = `${pkg.name} — ForgeExtensions`;

  const avatarHTML = author?.avatar
    ? `<img src="${esc(author.avatar)}" alt="${esc(author.name)}" />`
    : `<div class="ph">📦</div>`;
  const pipHTML = lead?.avatar && lead.avatar !== author?.avatar
    ? `<img class="pip" src="${esc(lead.avatar)}" alt="${esc(lead.name)}" />`
    : '';

  const btns = [];
  if (ghUrl)               btns.push([ghUrl,               ICON_GH,  'GitHub',        false]);
  if (links.npm)           btns.push([links.npm,           ICON_NPM, 'npm',           false]);
  if (links.documentation) btns.push([links.documentation, ICON_DOC, 'Documentation', true]);
  const btnsHTML = btns.map(([href, icon, label, primary]) =>
    `<a href="${esc(href)}" target="_blank" rel="noopener" class="btn${primary ? ' btn-primary' : ''}">${icon} ${label}</a>`
  ).join('');

  const tabDefs = [
    { id: 'home',      label: svgIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>') + ' Home' },
    { id: 'readme',    label: svgIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>') + ' Readme' },
    { id: 'functions', label: svgIcon('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>') + ' Functions' },
  ];

  const tabsHTML = tabDefs.map(t =>
    `<button class="tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');

  const panels = {
    home:      buildHomeTab(ext, type),
    readme:    buildReadmeTab(),
    functions: buildFunctionsTab(),
  };
  const panelsHTML = Object.entries(panels).map(([id, html]) =>
    `<div class="tab-panel${id === activeTab ? ' active' : ''}" data-panel="${id}">${html}</div>`
  ).join('');

  document.getElementById('root').innerHTML = `
    <div class="hero">
      <div class="hero-avatar">${avatarHTML}${pipHTML}</div>
      <div class="hero-text">
        <div class="hero-badges">
          <span class="badge" style="color:${TYPE_COLOR[type]};border-color:${TYPE_BORDER[type]}">${esc(TYPE_LABEL[type] ?? 'Unknown')}</span>
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

/* ── Boot ───────────────────────────────────────────────────────────────── */

async function main() {
  const { id, tab } = getParams();

  if (!id) { renderError('No extension ID provided. Use ?id=@scope/name'); return; }

  let list;
  try {
    list = await cachedFetch(LIST_URL);
  } catch {
    renderError('Failed to load extension list.'); return;
  }

  const entry = list.find(e => e.id === id);
  if (!entry) { renderError(`Extension "${id}" not found.`); return; }

  const type = entry.file.includes('/official/') ? 0
             : entry.file.includes('/community/') ? 1 : 2;

  let ext;
  try {
    ext = await cachedFetch(RAW_BASE + entry.file);
  } catch {
    renderError(`Failed to load extension data for "${id}".`); return;
  }

  renderPage(ext, type, tab);

  // Lazy loaders — each fetches only once on first activation
  let readmeLoaded    = false;
  let functionsLoaded = false;

  async function ensureReadme() {
    if (readmeLoaded) return;
    readmeLoaded = true;
    await loadReadme(ext.github);
  }

  async function ensureFunctions() {
    if (functionsLoaded) return;
    functionsLoaded = true;
    await loadFunctions(ext.github);
  }

  // Trigger whichever tab is active on load
  if (tab === 'readme')    ensureReadme();
  if (tab === 'functions') ensureFunctions();

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setTab(btn.dataset.tab);
      if (btn.dataset.tab === 'readme')    ensureReadme();
      if (btn.dataset.tab === 'functions') ensureFunctions();
    });
  });
}

main();