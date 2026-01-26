const fs = require("fs");
const path = require("path");

/* ------------------ config ------------------ */

const EXTENSIONS_DIR = path.resolve("./extensions");
const OUTPUT_FILE = path.join(EXTENSIONS_DIR, "list.json");

const TYPE_MAP = {
  official: 0,
  community: 1,
  unlisted: 2
};

/* ------------------ utils ------------------ */

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writePrettyJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidURL(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countByType(entries) {
  return entries.reduce(
    (acc, e) => {
      if (e.type === 0) acc.official++;
      else if (e.type === 1) acc.community++;
      else if (e.type === 2) acc.unlisted++;
      return acc;
    },
    { official: 0, community: 0, unlisted: 0 }
  );
}

function quickChart(config) {
  return `https://quickchart.io/chart?c=${encodeURIComponent(
    JSON.stringify(config)
  )}`;
}

/* ------------------ markdown ------------------------ */
function generateExtensionsMD(entries) {
  const counts = countByType(entries);

  const chartURL = quickChart({
    type: "pie",
    data: {
      labels: ["Official", "Community", "Unlisted"],
      datasets: [
        {
          data: [
            counts.official,
            counts.community,
            counts.unlisted
          ]
        }
      ]
    }
  });

  // prepare table rows
  const rows = entries.map(e => {
    const typeName =
      e.type === 0 ? "Official" :
      e.type === 1 ? "Community" :
      "Unlisted";

    return {
      id: `\`${e.id}\``,
      type: typeName,
      file: `\`${e.file}\``
    };
  });

  // column widths (including headers)
  const headers = { id: "ID", type: "Type", file: "File" };

  const idWidth = Math.max(
    headers.id.length,
    ...rows.map(r => r.id.length)
  );
  const typeWidth = Math.max(
    headers.type.length,
    ...rows.map(r => r.type.length)
  );
  const fileWidth = Math.max(
    headers.file.length,
    ...rows.map(r => r.file.length)
  );

  const pad = (str, len) => str + " ".repeat(len - str.length);

  let md = `# Extensions Registry

Total extensions: **${entries.length}**

## Distribution

![Extensions distribution](${chartURL})

## Extensions List

| ${pad(headers.id, idWidth)} | ${pad(headers.type, typeWidth)} | ${pad(headers.file, fileWidth)} |
| ${"-".repeat(idWidth)} | ${"-".repeat(typeWidth)} | ${"-".repeat(fileWidth)} |
`;

  for (const r of rows) {
    md += `| ${pad(r.id, idWidth)} | ${pad(r.type, typeWidth)} | ${pad(r.file, fileWidth)} |\n`;
  }

  return md;
}




/* ------------------ deep validation ------------------ */
function validateExtension(ext, filePath) {
  const ctx = path.relative(process.cwd(), filePath);

  assert(ext && typeof ext === "object", "Root must be an object");

  // id
  assert(isNonEmptyString(ext.id), "`id` must be a non-empty string");

  // package
  assert(ext.package && typeof ext.package === "object", "`package` must be an object");

  assert(isNonEmptyString(ext.package.name), "`package.name` must be a string");
  assert(
    isNonEmptyString(ext.package.description),
    "`package.description` must be a string"
  );

  assert(
    typeof ext.package.type === "number" && Number.isInteger(ext.package.type) && 0 <= ext.package.type && 2 >= ext.package.type,
    "`package.type` must be an integer"
  );

  // author (required)
  assert(
    ext.package.author && typeof ext.package.author === "object",
    "`package.author` must be an object"
  );

  assert(
    isNonEmptyString(ext.package.author.name),
    "`package.author.name` must be a string"
  );

  assert(
    isValidURL(ext.package.author.avatar),
    "`package.author.avatar` must be a valid URL"
  );

  // leadDeveloper (optional)
  if (ext.package.leadDeveloper !== undefined) {
    assert(
      typeof ext.package.leadDeveloper === "object",
      "`package.leadDeveloper` must be an object if provided"
    );

    assert(
      isNonEmptyString(ext.package.leadDeveloper.name),
      "`package.leadDeveloper.name` must be a string"
    );

    assert(
      isValidURL(ext.package.leadDeveloper.avatar),
      "`package.leadDeveloper.avatar` must be a valid URL"
    );
  }

  // github (required)
  assert(ext.github && typeof ext.github === "object", "`github` must be an object");

  assert(isNonEmptyString(ext.github.owner), "`github.owner` must be a string");
  assert(isNonEmptyString(ext.github.repo), "`github.repo` must be a string");

  // links (optional object, optional props)
  if (ext.links !== undefined) {
    assert(typeof ext.links === "object", "`links` must be an object if provided");

    if (ext.links.documentation !== undefined) {
      assert(
        isValidURL(ext.links.documentation),
        "`links.documentation` must be a valid URL"
      );
    }

    if (ext.links.npm !== undefined) {
      assert(
        isValidURL(ext.links.npm),
        "`links.npm` must be a valid URL"
      );
    }
  }

  console.log(`✓ Valid: ${ctx}`);
}


/* ------------------ main ------------------ */

const entries = [];

for (const folder of Object.keys(TYPE_MAP)) {
  const folderPath = path.join(EXTENSIONS_DIR, folder);
  if (!fs.existsSync(folderPath)) continue;

  for (const file of fs.readdirSync(folderPath)) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(folderPath, file);
    const ext = readJSON(filePath);

    try {
      validateExtension(ext, filePath);
      writePrettyJSON(filePath, ext);
    } catch (err) {
      console.error(`✗ Invalid: ${filePath}`);
      console.error("  →", err.message);
      process.exit(1);
    }

    entries.push({
      id: ext.id,
      type: TYPE_MAP[folder],
      file: `extensions/${path.relative(EXTENSIONS_DIR, filePath).replace(/\\/g, "/")}`
    });
  }
}

/* ------------------ sorting ------------------ */

entries.sort((a, b) => {
  if (a.type !== b.type) return a.type - b.type;
  return a.id.localeCompare(b.id);
});

/* ------------------ output ------------------ */

fs.writeFileSync("Extensions.md", generateExtensionsMD(entries))
writePrettyJSON(
  OUTPUT_FILE,
  entries.map(({ id, file }) => ({ id, file }))
);

console.log(`\n✔ Generated ${path.relative(process.cwd(), OUTPUT_FILE)}`);
