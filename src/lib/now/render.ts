// HTML renderers for the "now" widgets: a vinyl player, a bookshelf, a meal
// receipt and a tmux-style dashboard. They return strings so the same markup
// works in the terminal (client) and on the /now page (server).
import type { Book, Meal, Now, Track } from "@/data/now"
import { esc } from "@/scripts/terminal/html"

/** Wraps a label in something clickable; the terminal passes `cmd`. */
export type Action = (command: string, label: string) => string
const plain: Action = (_, label) => esc(label)

const PALETTE = [
  "--t-peach",
  "--t-magenta",
  "--t-blue",
  "--t-green",
  "--t-pink",
  "--t-yellow",
  "--t-lavender",
  "--t-sky",
  "--t-red",
  "--t-cyan",
]

const hashNum = (text: string) => {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

const colorFor = (text: string) =>
  `var(${PALETTE[hashNum(text) % PALETTE.length]})`

export const seconds = (duration?: string) => {
  if (!duration) return 210
  const [m, s] = duration.split(":").map(Number)
  return m * 60 + (s || 0)
}

export const clock = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`

export function ago(date: Date, now = new Date()) {
  const mins = Math.round((now.getTime() - date.getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  return `${Math.round(days / 30)} months ago`
}

const when = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.includes("T") ? { hour: "numeric", minute: "2-digit" } : {}),
  })

const linked = (text: string, url?: string) =>
  url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`
    : esc(text)

// ------------------------------------------------------------------ music

type PlayerOptions = {
  label?: string
  live?: boolean
  paused?: boolean
  compact?: boolean
}

export function player(track: Track, options: PlayerOptions = {}) {
  const { label = "on repeat lately", live, paused, compact } = options
  const duration = seconds(track.duration)
  const offset = Math.floor(
    duration * (0.2 + (hashNum(track.title) % 40) / 100),
  )
  const bars = Array.from({ length: compact ? 14 : 22 }, (_, i) => {
    const speed = (0.38 + ((i * 37) % 11) / 16).toFixed(2)
    const height = 35 + ((i * 53) % 65)
    return `<i style="--d:${speed}s;--h:${height}%"></i>`
  }).join("")
  const art = track.cover ? `<img src="${esc(track.cover)}" alt="">` : ""
  return [
    `<t-player data-duration="${duration}" data-offset="${offset}"${compact ? " data-compact" : ""}${paused ? " data-paused" : ""}>`,
    `<t-vinyl style="--label:${colorFor(track.album ?? track.title)}" aria-hidden="true">${art}</t-vinyl>`,
    "<t-track>",
    `<t-label>${live ? '<b class="t-live">●</b> ' : "▶ "}${esc(label)}</t-label>`,
    `<strong>${linked(track.title, track.url)}</strong>`,
    `<span>${esc(track.artist)}${track.album ? ` · ${esc(track.album)}` : ""}</span>`,
    `<t-eq aria-hidden="true">${bars}</t-eq>`,
    `<t-progress><time data-elapsed>${clock(offset)}</time><t-bar><t-fill style="width:${((offset / duration) * 100).toFixed(1)}%"></t-fill></t-bar><time>${track.duration ? esc(track.duration) : "--:--"}</time></t-progress>`,
    "</t-track>",
    "</t-player>",
  ].join("")
}

export const recent = (tracks: Track[]) =>
  tracks.length
    ? `<ol class="t-recent">${tracks
        .map(
          (track) =>
            `<li>${linked(track.title, track.url)} <span>— ${esc(track.artist)}</span></li>`,
        )
        .join("")}</ol>`
    : ""

// ------------------------------------------------------------------ books

const byShelfOrder = (books: Book[]) => [
  ...books.filter((book) => book.status === "finished"),
  ...books.filter((book) => book.status === "reading"),
  ...books.filter((book) => book.status === "queued"),
]

export function shelf(books: Book[]) {
  const spines = byShelfOrder(books)
    .map((book) => {
      const height = 72 + (hashNum(book.title) % 26)
      const width = (1.5 + Math.min(book.pages ?? 300, 900) / 700).toFixed(2)
      return `<t-book data-status="${book.status}" style="--c:${colorFor(book.title)};--h:${height}%;--w:${width}em" title="${esc(`${book.title} — ${book.author}`)}"><span>${esc(book.title)}</span></t-book>`
    })
    .join("")
  return `<t-shelf>${spines}<t-shelf-cat aria-hidden="true" title="every shelf needs a cat">🐈‍⬛</t-shelf-cat></t-shelf>`
}

/** A pacman progress bar, like pacman.conf's ILoveCandy. */
export function pacman(progress: number, width = 24) {
  const eaten = Math.round((Math.min(100, Math.max(0, progress)) / 100) * width)
  const trail = "-".repeat(Math.max(0, eaten - 1))
  const dots = Array.from({ length: width - eaten }, (_, i) =>
    (eaten + i) % 2 ? "o" : " ",
  ).join("")
  const mouth = eaten >= width ? "-" : "C"
  return `<t-pacman>[<span class="t-pac-trail">${trail}</span><span class="t-pac">${mouth}</span><span class="t-pac-dots">${dots}</span>] ${progress}%</t-pacman>`
}

const STATUS = {
  reading: "▸ reading",
  finished: "✓ finished",
  queued: "○ up next",
} as const

export function bookList(books: Book[]) {
  const order = [
    ...books.filter((book) => book.status === "reading"),
    ...books.filter((book) => book.status === "finished"),
    ...books.filter((book) => book.status === "queued"),
  ]
  return `<t-books>${order
    .map((book) => {
      const page =
        book.pages && book.progress !== undefined
          ? ` · p. ${Math.round((book.pages * book.progress) / 100)}/${book.pages}`
          : ""
      const progress =
        book.status === "reading" && book.progress !== undefined
          ? `<t-progress-line>${pacman(book.progress)}<span>${page}</span></t-progress-line>`
          : ""
      const note = book.note ? `<q>${esc(book.note)}</q>` : ""
      return `<t-status data-status="${book.status}">${STATUS[book.status]}</t-status><div><strong>${linked(book.title, book.url)}</strong> <span>— ${esc(book.author)}</span>${progress}${note}</div>`
    })
    .join("")}</t-books>`
}

// ------------------------------------------------------------------- food

export const RATING_MAX = 10

/** "★★★★★★★☆☆☆", clamped so an out-of-range rating can't break rendering. */
export const starText = (rating = 0) => {
  const filled = Math.min(RATING_MAX, Math.max(0, Math.round(rating)))
  return "★".repeat(filled) + "☆".repeat(RATING_MAX - filled)
}

const stars = (rating = 0) =>
  `<span class="t-stars" aria-label="${rating} out of ${RATING_MAX}">${starText(rating)}</span>`

export function receipt(meal: Meal, order: number, relative = false) {
  const date = new Date(meal.date)
  const again =
    (meal.rating ?? 0) >= 7 ? "yes" : (meal.rating ?? 0) >= 4 ? "maybe" : "no"
  const place = meal.city ? `${meal.place}, ${meal.city}` : meal.place
  return [
    "<t-receipt>",
    `<t-receipt-head><b>STOMACH.SERVICE</b><span>order #${String(order).padStart(4, "0")}</span><span>${esc(when(meal.date))}</span></t-receipt-head>`,
    "<t-receipt-rows>",
    `<div><span>item</span><span>${linked(meal.dish, meal.url)}</span></div>`,
    `<div><span>from</span><span>${esc(place)}</span></div>`,
    relative ? `<div><span>when</span><span>${ago(date)}</span></div>` : "",
    `<div><span>rating</span>${stars(meal.rating)}</div>`,
    "</t-receipt-rows>",
    meal.note ? `<q>${esc(meal.note)}</q>` : "",
    `<t-receipt-foot><t-barcode aria-hidden="true"></t-barcode><span>would eat again: ${again}</span></t-receipt-foot>`,
    "</t-receipt>",
  ].join("")
}

// ------------------------------------------------------------------- tmux

type DashboardOptions = {
  action?: Action
  listening?: {
    current: Track
    recent: Track[]
    label: string
    live: boolean
    paused: boolean
  }
  relative?: boolean
  host?: string
  time?: string
}

export function dashboard(now: Now, options: DashboardOptions = {}) {
  const { action = plain, relative = false, host = "david@portfolio" } = options
  const listening = options.listening ?? {
    ...now.listening,
    label: "on repeat lately",
    live: false,
    paused: false,
  }
  const current = now.reading.find((book) => book.status === "reading")
  const [meal] = now.ate
  const pane = (title: string, command: string, body: string, active = false) =>
    `<t-pane${active ? " data-active" : ""}><t-pane-title>${action(command, title)}</t-pane-title>${body}</t-pane>`

  const music = pane(
    "0:music",
    "np",
    player(listening.current, listening) + recent(listening.recent.slice(0, 3)),
    true,
  )
  const books = pane(
    "1:books",
    "reading",
    shelf(now.reading) +
      (current
        ? `<t-now-line><strong>${esc(current.title)}</strong> <span>— ${esc(current.author)}</span>${current.progress !== undefined ? pacman(current.progress, 16) : ""}</t-now-line>`
        : ""),
  )
  const food = pane(
    "2:food",
    "ate",
    meal
      ? `<t-now-line><span class="t-food-emoji" aria-hidden="true">🍽</span> <strong>${linked(meal.dish, meal.url)}</strong><span> @ ${esc(meal.place)}</span>${stars(meal.rating)}<span>${relative ? ago(new Date(meal.date)) : esc(when(meal.date))}${meal.note ? ` · “${esc(meal.note)}”` : ""}</span></t-now-line>`
      : "<t-now-line>fasting, apparently.</t-now-line>",
  )
  const status = `<t-tmux-status><span>[now]</span><span>0:music*</span><span>1:books</span><span>2:food-</span><span class="t-tmux-right">"${esc(host)}" ${esc(options.time ?? now.updated)}</span></t-tmux-status>`
  return `<t-tmux>${music}${books}${food}${status}</t-tmux>`
}
