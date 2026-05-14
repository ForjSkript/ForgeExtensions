const fs   = require("fs");
const path = require("path");

/* ── Config ───────────────────────────────────────────────────────────────── */

const EXTENSIONS_DIR = path.resolve("./extensions");
const OUTPUT_FILE    = path.join(EXTENSIONS_DIR, "list.json");
const MD_FILE        = path.resolve("Extensions.md");
const SCHEMA_URL     = "https://raw.githubusercontent.com/ForjSkript/ForgeExtensions/refs/heads/main/extensions/$schema.json";

const TYPE_MAP = { official: 0, community: 1, unlisted: 2 };

/* ── Utils ────────────────────────────────────────────────────────────────── */

const readJSON  = f => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2) + "\n");
const isStr     = v => typeof v === "string" && v.trim().length > 0;
const isURL     = v => { if (!isStr(v)) return false; try { new URL(v); return true; } catch { return false; } };
const assert    = (ok, msg) => { if (!ok) throw new Error(msg); };

/* ── Validation ───────────────────────────────────────────────────────────── */

function validate(ext, filePath) {
  const rel = path.relative(process.cwd(), filePath);

  assert(ext && typeof ext === "object", "Root must be an object");
  assert(isURL(ext.$schema),            `Missing or invalid $schema — should be:\n  "${SCHEMA_URL}"`);
  assert(isStr(ext.id),                 "`id` must be a non-empty string");

  // package
  const pkg = ext.package;
  assert(pkg && typeof pkg === "object",        "`package` must be an object");
  assert(isStr(pkg.name),                       "`package.name` must be a non-empty string");
  assert(isStr(pkg.description),               "`package.description` must be a non-empty string");
  assert(Number.isInteger(pkg.type) && pkg.type >= 0 && pkg.type <= 2,
                                                "`package.type` must be 0 (official), 1 (community), or 2 (unlisted)");

  // author
  const author = pkg.author;
  assert(author && typeof author === "object",  "`package.author` must be an object");
  assert(isStr(author.name),                   "`package.author.name` must be a non-empty string");
  assert(isURL(author.avatar),                 "`package.author.avatar` must be a valid URL");

  // leadDeveloper (optional)
  if (pkg.leadDeveloper !== undefined) {
    const ld = pkg.leadDeveloper;
    assert(ld && typeof ld === "object",        "`package.leadDeveloper` must be an object");
    assert(isStr(ld.name),                     "`package.leadDeveloper.name` must be a non-empty string");
    assert(isURL(ld.avatar),                   "`package.leadDeveloper.avatar` must be a valid URL");
  }

  // github
  const gh = ext.github;
  assert(gh && typeof gh === "object",          "`github` must be an object");
  assert(isStr(gh.owner),                       "`github.owner` must be a non-empty string");
  assert(isStr(gh.repo),                        "`github.repo` must be a non-empty string");

  // links (optional)
  if (ext.links !== undefined) {
    assert(typeof ext.links === "object",       "`links` must be an object");
    if (ext.links.documentation !== undefined)
      assert(isURL(ext.links.documentation),   "`links.documentation` must be a valid URL");
    if (ext.links.npm !== undefined)
      assert(isURL(ext.links.npm),             "`links.npm` must be a valid URL");
  }

  console.log(`  ✓  ${rel}`);
}

/* ── Markdown ─────────────────────────────────────────────────────────────── */

function buildMarkdown(entries) {
  const counts = { official: 0, community: 0, unlisted: 0 };
  for (const e of entries) {
    if (e.type === 0) counts.official++;
    else if (e.type === 1) counts.community++;
    else counts.unlisted++;
  }

  const chartURL = "https://quickchart.io/chart?c=" + encodeURIComponent(JSON.stringify({
    type: "doughnut",
    data: {
      labels: ["Official", "Community", "Unlisted"],
      datasets: [{
        data: [counts.official, counts.community, counts.unlisted],
        backgroundColor: ['#4CAF50', '#2196F3', '#9E9E9E'],
        borderWidth: 2
      }],
    },
    options: {
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  }));

  const sections = {
    0: { title: "🟢 Official",   rows: [] },
    1: { title: "🔵 Community",  rows: [] },
    2: { title: "⚪ Unlisted",   rows: [] },
  };

  for (const e of entries) {
    const authorStr = e.leadDeveloper ? `${e.author} (Lead: ${e.leadDeveloper})` : e.author;
    const links = [];
    if (e.links.documentation) links.push(`[📖 Docs](${e.links.documentation})`);
    if (e.links.npm) links.push(`[📦 NPM](${e.links.npm})`);
    const linksStr = links.join(' · ');
    sections[e.type].rows.push(`| [${e.name}](${e.file}) | ${e.description} | ${authorStr} | ${linksStr} |`);
  }

  let md = `# 📦 Extensions Registry\n\n`
    + `**Total:** ${entries.length} `
    + `(${counts.official} official · ${counts.community} community · ${counts.unlisted} unlisted)\n\n`
    + `## 📊 Distribution\n\n![Distribution](${chartURL})\n\n---\n`;

  for (const key of [0, 1, 2]) {
    const { title, rows } = sections[key];
    md += `\n## ${title}\n\n`;
    if (rows.length) {
      md += `| Extension | Description | Author | Links |\n|-----------|-------------|--------|-------|\n`;
      md += rows.join('\n') + '\n';
    } else {
      md += "_No extensions in this category._\n";
    }
  }

  return md.trim() + "\n";
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

console.log("Building extension list…\n");

let errors  = 0;
const entries = [];

for (const [folder, type] of Object.entries(TYPE_MAP)) {
  const folderPath = path.join(EXTENSIONS_DIR, folder);
  if (!fs.existsSync(folderPath)) continue;

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
  if (!files.length) continue;

  console.log(`[${folder}]`);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    let ext;

    try {
      ext = readJSON(filePath);
    } catch (err) {
      console.error(`  ✗  ${path.relative(process.cwd(), filePath)}`);
      console.error(`     → Failed to parse JSON: ${err.message}`);
      errors++;
      continue;
    }

    try {
      validate(ext, filePath);
      writeJSON(filePath, ext); // normalize formatting in place
    } catch (err) {
      console.error(`  ✗  ${path.relative(process.cwd(), filePath)}`);
      console.error(`     → ${err.message}`);
      errors++;
      continue;
    }

    entries.push({
      id:          ext.id,
      file:        `extensions/${path.relative(EXTENSIONS_DIR, filePath).replace(/\\/g, "/")}`,
      name:        ext.package.name,
      description: ext.package.description,
      author:      ext.package.author.name,
      leadDeveloper: ext.package.leadDeveloper ? ext.package.leadDeveloper.name : null,
      links:       ext.links || {},
    });
  }

  console.log();
}

if (errors > 0) {
  console.error(`\n✖  ${errors} error(s) found. Fix them before generating list.json.\n`);
  process.exit(1);
}

/* ── Sort: official → community → unlisted, then alphabetically by id ── */

entries.sort((a, b) => {
  const ta = TYPE_MAP[a.file.split("/")[1]] ?? 2;
  const tb = TYPE_MAP[b.file.split("/")[1]] ?? 2;
  return ta !== tb ? ta - tb : a.id.localeCompare(b.id);
});

/* ── Write outputs ────────────────────────────────────────────────────────── */

writeJSON(OUTPUT_FILE, entries);
fs.writeFileSync(MD_FILE, buildMarkdown(
  entries.map(e => ({ ...e, type: TYPE_MAP[e.file.split("/")[1]] ?? 2 }))
));

console.log(`✔  extensions/list.json  (${entries.length} entries)`);
console.log(`✔  Extensions.md`);