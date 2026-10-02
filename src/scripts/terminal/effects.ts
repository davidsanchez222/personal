import {
  c,
  esc,
  reducedMotion,
  sleep,
  untilAborted,
} from "@/scripts/terminal/html"
import type { Terminal } from "@/scripts/terminal/shell"

// ANSI Shadow, trimmed to the letters the banner needs.
const FIGLET: Record<string, string[]> = {
  D: ["██████╗ ", "██╔══██╗", "██║  ██║", "██║  ██║", "██████╔╝", "╚═════╝ "],
  A: [" █████╗ ", "██╔══██╗", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
  V: [
    "██╗   ██╗",
    "██║   ██║",
    "██║   ██║",
    "╚██╗ ██╔╝",
    " ╚████╔╝ ",
    "  ╚═══╝  ",
  ],
  I: ["██╗", "██║", "██║", "██║", "██║", "╚═╝"],
}

export function figlet(word: string): string | undefined {
  const letters = [...word.toUpperCase()].map((ch) => FIGLET[ch])
  if (letters.some((letter) => !letter)) return undefined
  return Array.from({ length: 6 }, (_, row) =>
    letters.map((letter) => letter[row]).join(""),
  ).join("\n")
}

export const TUX = [
  "        .--.      ",
  "       |o_o |     ",
  "       |:_/ |     ",
  "      //   \\ \\    ",
  "     (|     | )   ",
  "    /'\\_   _/`\\   ",
  "    \\___)=(___/   ",
]

export function browserName(): string {
  const ua = navigator.userAgent
  const match = /(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/.exec(ua) ?? undefined
  if (!match) return "a mysterious browser"
  const names: Record<string, string> = {
    Edg: "Edge",
    OPR: "Opera",
    Firefox: "Firefox",
    Chrome: "Chrome",
    Version: "Safari",
  }
  return `${names[match[1]]} ${match[2]}`
}

export function cowsay(text: string, eyes = "oo"): string {
  const width = 40
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const word of paragraph.split(/\s+/)) {
      if (line && line.length + word.length + 1 > width) {
        lines.push(line)
        line = word
      } else line = line ? `${line} ${word}` : word
    }
    lines.push(line)
  }
  const max = Math.max(...lines.map((line) => line.length))
  const body =
    lines.length === 1
      ? [`< ${lines[0]} >`]
      : lines.map((line, i) => {
          const [l, r] =
            i === 0
              ? ["/", "\\"]
              : i === lines.length - 1
                ? ["\\", "/"]
                : ["|", "|"]
          return `${l} ${line.padEnd(max)} ${r}`
        })
  return [
    ` ${"_".repeat(max + 2)}`,
    ...body,
    ` ${"-".repeat(max + 2)}`,
    "        \\   ^__^",
    `         \\  (${eyes})\\_______`,
    "            (__)\\       )\\/\\",
    "                ||----w |",
    "                ||     ||",
  ].join("\n")
}

export function rainbow(text: string, offset = Math.random() * 360): string {
  return [...text]
    .map((ch, i) =>
      ch.trim()
        ? `<span style="color:hsl(${(offset + i * 9) % 360} 85% 62%)">${esc(ch)}</span>`
        : esc(ch),
    )
    .join("")
}

/** Width of the terminal in monospace columns. */
export function columns(term: Terminal): number {
  const probe = document.createElement("span")
  probe.textContent = "0".repeat(20)
  probe.style.visibility = "hidden"
  term.el.out.append(probe)
  const ch = probe.getBoundingClientRect().width / 20 || 8
  probe.remove()
  const style = getComputedStyle(term.el.body)
  const inner =
    term.el.body.clientWidth -
    Number.parseFloat(style.paddingLeft) -
    Number.parseFloat(style.paddingRight)
  return Math.max(20, Math.floor(inner / ch))
}

export async function cmatrix(term: Terminal, signal: AbortSignal) {
  const host = term.el.body.parentElement ?? term.el.body
  const canvas = document.createElement("canvas")
  canvas.className = "t-overlay"
  host.append(canvas)
  const ctx = canvas.getContext("2d")
  const glyphs = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789$_>|{}[]<>/\\=+*"
  const size = 16
  const resize = () => {
    canvas.width = host.clientWidth
    canvas.height = host.clientHeight
  }
  resize()
  const drops = Array.from(
    { length: Math.ceil(canvas.width / size) },
    () => Math.random() * -50,
  )
  const green =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--t-green")
      .trim() || "#4ade80"
  term.onKey = () => term.interrupt(true)
  const timer = setInterval(
    () => {
      if (!ctx) return
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = `${size}px monospace`
      drops.forEach((y, i) => {
        const glyph = glyphs[Math.floor(Math.random() * glyphs.length)]
        ctx.fillStyle = Math.random() > 0.95 ? "#e6ffe6" : green
        ctx.fillText(glyph, i * size, y * size)
        drops[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1
      })
    },
    reducedMotion() ? 200 : 50,
  )
  await untilAborted(signal)
  clearInterval(timer)
  canvas.remove()
  term.print(c("muted", "wake up, neo…"))
}

const TRAIN = [
  "      ====        ________                ___________ ",
  "  _D _|  |_______/        \\__I_I_____===__|_________| ",
  "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
  "   /     |  |   H  |  |     |   |         ||_| |_||   ",
  "  |      |  |   H  |__--------------------| [___] |   ",
  "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
  "  |/ |   |-----------I_____I [][] []  D   |=======|__ ",
  "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
  " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ",
  "  \\_/      \\O=====O=====O=====O_/      \\_/             ",
]

/** Like the real sl(1), this ignores Ctrl+C. You typed `sl`. You live with it. */
export async function sl(term: Terminal) {
  const width = columns(term)
  const line = term.print("", "t-pre")
  const trainWidth = TRAIN[0].length
  const step = reducedMotion() ? 6 : 2
  for (let x = width; x > -trainWidth; x -= step) {
    line.textContent = TRAIN.map((row) => {
      const visible = x >= 0 ? " ".repeat(x) + row : row.slice(-x)
      return visible.slice(0, width)
    }).join("\n")
    await sleep(28)
  }
  line.remove()
}

export function party() {
  const root = document.documentElement
  root.classList.add("t-party")
  setTimeout(() => root.classList.remove("t-party"), 4000)
}

export const FORTUNES = [
  "There are only two hard things in Computer Science: cache invalidation and naming things.\n    — Phil Karlton",
  "Talk is cheap. Show me the code.\n    — Linus Torvalds",
  "Programs must be written for people to read, and only incidentally for machines to execute.\n    — Harold Abelson",
  "Unix is user-friendly. It's just very selective about who its friends are.",
  "Premature optimization is the root of all evil.\n    — Donald Knuth",
  "The best way to predict the future is to invent it.\n    — Alan Kay",
  "Simplicity is prerequisite for reliability.\n    — Edsger W. Dijkstra",
  "It works on my machine.\n    — every developer, ever",
  "I've been using Vim for about two years now, mostly because I can't figure out how to exit it.",
  "Weeks of coding can save you hours of planning.",
  "There's no place like 127.0.0.1",
  "To understand recursion, you must first understand recursion.",
  "Walking on water and developing software from a specification are easy if both are frozen.\n    — Edward V. Berard",
  "A good programmer is someone who always looks both ways before crossing a one-way street.",
]
