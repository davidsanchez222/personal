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

// Coming back from the blog through the back/forward cache.
addEventListener("pageshow", (event) => {
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
start().then(() => term.focus())
