import { startTicker } from "@/lib/now/live"
import type { TermData } from "@/lib/terminal/types"
import { BOOTED_KEY, boot } from "@/scripts/terminal/boot"
import {
  SESSION_START,
  commandNames,
  createCommands,
} from "@/scripts/terminal/commands"
import { buildFs } from "@/scripts/terminal/fs"
import { storage } from "@/scripts/terminal/html"
import { Terminal } from "@/scripts/terminal/shell"

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T

const data: TermData = JSON.parse($("term-data").textContent ?? "{}")
const commands = createCommands()
const term = new Terminal(
  {
    body: $("term-body"),
    out: $("term-output"),
    prompt: $("term-prompt"),
    ps1: $("term-ps1"),
    before: $("term-before"),
    cursor: $("term-cursor"),
    after: $("term-after"),
    input: $<HTMLInputElement>("term-input"),
    title: $("term-title"),
  },
  data,
  buildFs(data, commandNames(commands)),
  commands,
)

if (!storage.get(sessionStorage, SESSION_START))
  storage.set(sessionStorage, SESSION_START, String(Date.now()))

const motd = () => term.exec("motd", { echo: false })

async function start() {
  if (term.restore()) return
  if (!storage.get(sessionStorage, BOOTED_KEY)) await boot(term)
  await motd()
}

// The title bar's traffic lights: close hands off to the blog, minimize
// collapses the window to its title bar and zoom fills the viewport.
const ZOOM_KEY = "dsh.zoomed"
const win = document.querySelector("term-window") as HTMLElement
const root = document.documentElement

const restore = () => {
  win.removeAttribute("data-minimized")
  term.focus()
}

win.querySelector("term-titlebar")?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement
  const action = target.closest<HTMLElement>("[data-win]")?.dataset.win
  if (action === "close") {
    term.interrupt(true)
    win.dataset.closing = ""
    term.go("/blog", "gui", new AbortController().signal, 180)
  } else if (action === "minimize") {
    if (win.toggleAttribute("data-minimized")) term.el.input.blur()
    else term.focus()
  } else if (action === "zoom") {
    const zoomed = root.toggleAttribute("data-term-zoomed")
    storage.set(localStorage, ZOOM_KEY, zoomed ? "1" : null)
    restore()
  } else if (win.hasAttribute("data-minimized") && !target.closest("a")) {
    restore()
  }
})
term.el.input.addEventListener("focus", () =>
  win.removeAttribute("data-minimized"),
)

// Coming back from the blog through the back/forward cache.
addEventListener("pageshow", (event) => {
  win.removeAttribute("data-closing")
  if (event.persisted && term.job) term.finishJob(term.job)
})
addEventListener("pagehide", () => term.persist())

// ↑ ↑ ↓ ↓ ← → ← → b a
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
]
let progress = 0
addEventListener(
  "keydown",
  (event) => {
    progress =
      event.key === KONAMI[progress]
        ? progress + 1
        : event.key === KONAMI[0]
          ? 1
          : 0
    if (progress === KONAMI.length) {
      progress = 0
      term.exec("konami")
    }
  },
  { capture: true },
)

document.documentElement.classList.add("t-ready")
startTicker()
start().then(() => term.focus())
