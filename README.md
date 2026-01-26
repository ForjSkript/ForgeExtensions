# 📦 ForgeExtensions

A curated registry of extensions built for the **ForgeScript / ForjSkript bot ecosystem**.

This repository exists to **list, validate, and index extensions** so ForgeScript-powered bots can discover and use them in a consistent, structured way.

## 🎯 Purpose

ForgeExtensions is a centralized list of **extensions made for the ForjSkript bot to work with**.

Each extension:

- Declares metadata in a strict JSON format
- Is validated against a shared schema
- Is categorized as **Official**, **Community**, or **Unlisted**
- Can be programmatically indexed and consumed

This keeps the ecosystem **discoverable, reliable, and scalable**.

## 📚 Registry Index

👉 **See the full list of extensions here:**  
**[`Extensions.md`](./Extensions.md)**

The index includes:

- Extension ID
- Category (Official / Community / Unlisted)
- Path to the extension metadata
- A distribution chart of extension types

## ⚙️ How This Works

1. Each extension lives as a JSON file under:

```md
extensions/
├─ official/
├─ community/
└─ unlisted/
```

2. Every extension file:

- References a shared JSON Schema (`$schema`)
- Is deeply validated (types, URLs, required fields, etc.)

3. A build script:

- Scans all extension files
- Validates them against the schema
- Sorts them by type and name
- Generates:
  - `extensions/list.json` (machine-readable)
  - `Extensions.md` (human-readable)

No manual lists. No duplicated data. Everything comes from source.

## ➕ Adding an Extension

### 1️⃣ Choose the correct category

Place your file in **one** of the following:

- `extensions/official/` → Maintained by the ForgeScript team
- `extensions/community/` → Marked as community by ForgeScript team
- `extensions/unlisted/` → Unmarked by ForgeScript team *yet*

### 2️⃣ Create your metadata file

File name should match your extension name:

```txt
extensions/community/MyExtension.json
````

Your file **must** include `$schema`:

```json
{
  "$schema": "https://raw.githubusercontent.com/ForjSkript/ForgeExtensions/refs/heads/main/extensions/$schema.json",
  "id": "@your-scope/my-extension",
  // or "id": "my-extension",
  ...
}
```

If it doesn’t validate, it won’t be indexed.

### 3️⃣ Validate & submit

- Run the validation/build script locally
- Ensure no schema or lint errors
- Open a Pull Request with your extension JSON

That’s it 🎉

## 🤝 Contributing

Contributions are welcome!

You can help by:

- Adding new extensions
- Improving the schema
- Enhancing validation or tooling
- Fixing documentation or typos

Please keep changes:

- Focused
- Well-documented
- Consistent with existing structure

## 📄 License

See the repository license for usage terms.
