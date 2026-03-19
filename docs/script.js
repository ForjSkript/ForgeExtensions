const rawBase =
  "https://raw.githubusercontent.com/ForjSkript/ForgeExtensions/refs/heads/main"

const listURL = `${rawBase}/extensions/list.json`

let listData = []
let filteredData = []


async function loadExtensions() {
  const list = await cachedFetch(listURL)
  listData = sortExtensions(list)
  filteredData = listData

  setupSearch()
  renderExtensions()
}


/**
 * Cache fetch (10 min TTL)
 */
async function cachedFetch(url) {
  const key = "cache:" + url
  const cached = localStorage.getItem(key)

  if (cached) {
    const { time, data } = JSON.parse(cached)
    if (Date.now() - time < 10 * 60 * 1000) return data
  }

  const res = await fetch(url)
  const data = await res.json()

  localStorage.setItem(
    key,
    JSON.stringify({ time: Date.now(), data })
  )

  return data
}


/**
 * Sort extensions
 */
function sortExtensions(list) {
  return [...list].sort((a, b) => {
    if (a.id === "@tryforge/forgescript") return -1
    if (b.id === "@tryforge/forgescript") return 1
    return a.name.localeCompare(b.name)
  })
}


/**
 * Setup search input
 */
function setupSearch() {
  const input = document.getElementById("search")

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase()

    filteredData = listData.filter(ext =>
      ext.id.toLowerCase().includes(q) ||
      ext.name.toLowerCase().includes(q)
    )

    if(!filteredData.length) {
      filteredData = listData.filter(ext =>
        ext.description.toLowerCase().includes(q)
      )
    }

    renderExtensions()
  })
}


/**
 * Detect extension type from file path
 */
function getType(file) {
  if (file.includes("extensions/official/")) return "official"
  if (file.includes("extensions/community/")) return "community"
  return "unlisted"
}


/**
 * Get color styles based on type
 */
function getTypeStyles(type) {
  switch (type) {
    case "official":
      return "border-blue-500/30 bg-blue-500/5"
    case "community":
      return "border-green-500/30 bg-green-500/5"
    default:
      return "border-yellow-500/30 bg-yellow-500/5"
  }
}


/**
 * Render extensions
 */
function renderExtensions() {
  const container = document.getElementById("extensions")
  container.innerHTML = ""

  filteredData.forEach((ext, i) => {
    const type = getType(ext.file)
    const styles = getTypeStyles(type)

    const el = document.createElement("div")

    el.className = `
      opacity-0 translate-y-4
      rounded-xl border p-4 transition-all duration-500
      ${styles}
    `

    el.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-semibold">${ext.name}</h2>
        <span class="text-xs text-slate-500">${ext.id}</span>
      </div>

      <p class="text-sm text-slate-400 mb-3">
        ${ext.description || "No description provided."}
      </p>

      <div class="flex items-center justify-between">
        <span class="text-xs capitalize text-slate-400">${type}</span>

        <a
          href="${rawBase}/${ext.file}"
          target="_blank"
          class="text-sm text-blue-400 hover:underline"
        >
          View
        </a>
      </div>
    `

    container.appendChild(el)

    // ✨ fade-up animation (staggered)
    setTimeout(() => {
      el.classList.remove("opacity-0", "translate-y-4")
    }, i * 60)
  })
}


loadExtensions()