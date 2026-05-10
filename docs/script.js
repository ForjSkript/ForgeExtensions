"use strict";
const RAW_BASE =
  "https://raw.githubusercontent.com/ForjSkript/ForgeExtensions/refs/heads/main/";
const LIST_URL = `${RAW_BASE}extensions/list.json`;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

const TYPE_LABELS = ["official", "community", "unlisted"];
const TYPE_DISPLAY = ["Official", "Community", "Unlisted"];
const TYPE_BADGE = ["badge-official", "badge-community", "badge-unlisted"];
const TYPE_ICONS = ["🔧", "🌐", "🔒"];

let allExtensions = [];
let activeFilter = "all";
let activeSort = "name-asc";
let searchQuery = "";

// ── Cache ─────────────────────────────────────────────────────────────── 

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

// ── Helpers ────────────────────────────────────────────────────────────────

function typeFromFile(f) {
  return f.includes("/official/") ? 0 : f.includes("/community/") ? 1 : 2;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function loadExtensions() {
  const data = await cachedFetch(LIST_URL);
  allExtensions = data.map((e) => ({
    ...e,
    type: typeFromFile(e.file),
    _meta: null,
  }));
  render();
  allExtensions.forEach((e, i) => fetchMeta(e, i));
}

async function fetchMeta(ext, i) {
  try {
    const meta = await cachedFetch(RAW_BASE + ext.file);
    allExtensions[i]._meta = meta;
    const card = document.querySelector(`[data-id="${CSS.escape(ext.id)}"]`);
    if (card) patchCard(card, meta);
  } catch (_) {}
}

// ── Patch card with full metadata ──────────────────────────────────────────

function patchCard(card, meta) {
  const aAvatar = meta?.package?.author?.avatar;
  const aName = meta?.package?.author?.name;
  const lAvatar = meta?.package?.leadDeveloper?.avatar;
  const lName = meta?.package?.leadDeveloper?.name;

  const aw = card.querySelector(".avatar-wrap");
  if (aw) {
    let tipText = aName || "";
    if (lName && lName !== aName) tipText += ` · lead: ${lName}`;
    aw.innerHTML = `
      <div class="avatar-stack has-tip">
        ${
          aAvatar
            ? `<img class="card-avatar" src="${esc(aAvatar)}" alt="${esc(aName || "")}" loading="lazy" />`
            : `<div class="card-avatar-ph">${TYPE_ICONS[+card.dataset.type || 0]}</div>`
        }
        ${
          lAvatar && lAvatar !== aAvatar
            ? `<img class="avatar-pip" src="${esc(lAvatar)}" alt="${esc(lName || "")}" loading="lazy" />`
            : ""
        }
        ${tipText ? `<span class="tip">${esc(tipText)}</span>` : ""}
      </div>`;
  }

  const bw = card.querySelector(".branches-wrap");
  const branches = meta?.github?.branches;
  const def = meta?.github?.defaultBranch;
  if (bw && branches?.length) {
    bw.innerHTML = branches
      .map(
        (b) =>
          `<span class="branch-tag${b === def ? " default" : ""}">${esc(b)}</span>`,
      )
      .join("");
  }

  const footer = card.querySelector(".card-footer");
  if (!footer) return;
  footer.innerHTML = "";
  footer.appendChild(
    mkBtn(
      `ext.html?id=${encodeURIComponent(card.dataset.id)}`,
      iExt(),
      "View",
      true,
    ),
  );
}

// ── Render ─────────────────────────────────────────────────────────────────

function render() {
  const container = document.getElementById("extensions");
  const empty = document.getElementById("empty");

  let list = allExtensions.filter((e) => {
    const okT = activeFilter === "all" || TYPE_LABELS[e.type] === activeFilter;
    const q = searchQuery.toLowerCase();
    const okQ =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q);
    return okT && okQ;
  });

  list = [...list].sort((a, b) => {
    if (activeSort === "name-asc") return a.name.localeCompare(b.name);
    if (activeSort === "name-desc") return b.name.localeCompare(a.name);
    if (activeSort === "type-asc")
      return a.type - b.type || a.name.localeCompare(b.name);
    if (activeSort === "type-desc")
      return b.type - a.type || a.name.localeCompare(b.name);
    return 0;
  });

  Array.from(container.children).forEach((c) => {
    if (c.id !== "empty") c.remove();
  });

  if (!list.length) {
    empty.style.display = "block";
  } else {
    empty.style.display = "none";
    list.forEach((ext) => {
      const card = buildCard(ext);
      container.appendChild(card);
      if (ext._meta) patchCard(card, ext._meta);
    });
  }

  const by = [0, 1, 2].map(
    (t) => allExtensions.filter((e) => e.type === t).length,
  );
  document.getElementById("count-display").innerHTML =
    `${list.length} of ${allExtensions.length} &nbsp;·&nbsp; ` +
    `<span style="color:var(--official)">${by[0]} official</span> &nbsp;` +
    `<span style="color:var(--community)">${by[1]} community</span> &nbsp;` +
    `<span style="color:var(--unlisted)">${by[2]} unlisted</span>`;
}

// ── Build card ─────────────────────────────────────────────────────────────

function buildCard(ext) {
  const card = document.createElement("a");
  card.className = "card";
  card.href = `ext.html?id=${encodeURIComponent(ext.id)}`;
  card.dataset.id = ext.id;
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

function mkBtn(href, icon, label, primary) {
  const a = document.createElement("a");
  a.href = href;
  a.className = primary ? "btn btn-primary" : "btn";
  a.innerHTML = `${icon} ${label}`;
  return a;
}

// ── SVG icons ──────────────────────────────────────────────────────────────

function iExt() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
}

// ── Events ─────────────────────────────────────────────────────────────────

document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  render();
});

document.getElementById("sort").addEventListener("change", (e) => {
  activeSort = e.target.value;
  render();
});

document.querySelectorAll(".pill").forEach((p) =>
  p.addEventListener("click", () => {
    document
      .querySelectorAll(".pill")
      .forEach((x) => x.classList.remove("active"));
    p.classList.add("active");
    activeFilter = p.dataset.type;
    render();
  }),
);

// ── Boot ───────────────────────────────────────────────────────────────────

loadExtensions();
