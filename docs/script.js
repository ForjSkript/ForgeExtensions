"use strict";
const RAW_BASE =
  "https://raw.githubusercontent.com/ForjSkript/ForgeExtensions/refs/heads/main/";
const LIST_URL = `${RAW_BASE}extensions/list.json`;

const TYPE_LABELS = ["official", "community", "unlisted"];
const TYPE_DISPLAY = ["Official", "Community", "Unlisted"];
const TYPE_BADGE = ["badge-official", "badge-community", "badge-unlisted"];
const TYPE_ICONS = ["🔧", "🌐", "🔒"];

let allExtensions = [];
let activeFilter = "all";
let activeSort = "name-asc";
let searchQuery = "";

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
  const data = await (await fetch(LIST_URL)).json();
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
    const res = await fetch(RAW_BASE + ext.file);
    if (!res.ok) return;
    const meta = await res.json();
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
  const ghOwner = meta?.github?.owner;
  const ghRepo = meta?.github?.repo;
  const npmUrl = meta?.links?.npm;
  const docUrl = meta?.links?.documentation;

  footer.innerHTML = "";
  if (ghOwner && ghRepo)
    footer.appendChild(
      mkBtn(`https://github.com/${ghOwner}/${ghRepo}`, iGH(), "GitHub", false),
    );
  if (npmUrl) footer.appendChild(mkBtn(npmUrl, iNpm(), "npm", false));
  if (docUrl) footer.appendChild(mkBtn(docUrl, iDoc(), "Docs", true));
  if (!footer.children.length) footer.style.display = "none";
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
  const card = document.createElement("div");
  card.className = "card";
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
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = primary ? "btn btn-primary" : "btn";
  a.innerHTML = `${icon} ${label}`;
  return a;
}

// ── SVG icons ──────────────────────────────────────────────────────────────

function iGH() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58 0-.28-.01-1.02-.01-2-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.32-1.75-1.32-1.75-1.08-.74.08-.72.08-.72 1.2.08 1.82 1.23 1.82 1.23 1.07 1.83 2.8 1.3 3.48 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>`;
}

function iNpm() {
  return `<svg width="14" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M0 7.3v9.4h6.7v1.6h5.3v-1.6H24V7.3H0zm6.7 8H5.3V9.9H4v5.4H1.3V8.6h5.4v6.7zm6.6 1.6h-2.6v-1.6h-1.4V9.9h4V16.9zm9.4-1.6h-1.4v5.4h-2.6V9.9H16v5.4h-1.3V8.6h6.6v6.7z"/></svg>`;
}

function iDoc() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
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
