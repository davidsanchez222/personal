import { c, esc } from "@/scripts/terminal/html"
import type { Terminal } from "@/scripts/terminal/shell"

// A small modal vim: normal, insert and command-line modes over a scratch
// buffer, drawn in place of the prompt. Getting out is still the hard part.

type Mode = "normal" | "insert" | "command"

const SPLASH = [
  "",
  `<span class="t-bold">VIM - Vi IMproved</span>`,
  "",
  "version 9.1.0",
  "by Bram Moolenaar et al. (rest in peace, Bram)",
  "",
  `type  ${c("yellow", ":q<Enter>")}       to exit`,
  c("muted", "(if only it were that easy)"),
]

const QUIT = /^(q|quit|qa|qall)$/
const FORCE_QUIT = /^(q|quit|qa|qall|cq)!$/
const WRITE_QUIT = /^(wq|wqa|x|xa|exit)!?$/

export function vim(term: Terminal, file: string[], name?: string) {
  const lines = file.length ? [...file] : [""]
  const readonly = Boolean(name)
  const undo: { lines: string[]; row: number; col: number }[] = []
  let mode: Mode = "normal"
  let row = 0
  let col = 0
  let command = ""
  let pending = ""
  let recording = ""
  let modified = false
  let warned = false
  let splash = !name
  let attempts = 0
  let message = name
    ? `"${esc(name)}" [readonly] ${lines.length}L, ${file.join("\n").length}B`
    : ""

  const screen = term.print("", "t-vim")
  screen.setAttribute("aria-live", "off")

  // ---------------------------------------------------------------- drawing

  const lastCol = () =>
    Math.max(0, lines[row].length - (mode === "insert" ? 0 : 1))
  const clamp = () => {
    row = Math.max(0, Math.min(row, lines.length - 1))
    col = Math.max(0, Math.min(col, lastCol()))
  }

  const cursor = (ch: string, cls = "t-vim-cursor") =>
    `<span class="${cls}">${esc(ch || " ")}</span>`

  const drawLine = (line: string, i: number) => {
    if (i !== row || mode === "command") return esc(line) || " "
    return (
      esc(line.slice(0, col)) +
      cursor(
        line[col] ?? "",
        mode === "insert" ? "t-vim-cursor t-vim-bar" : undefined,
      ) +
      esc(line.slice(col + 1))
    )
  }

  const status = () => {
    if (mode === "command") return `:${esc(command)}${cursor("")}`
    if (mode === "insert") return message || c("bold", "-- INSERT --")
    if (recording) return `recording @${esc(recording)}`
    return message
  }

  const render = () => {
    const rows = lines.map(
      (line, i) => `<div class="t-line">${drawLine(line, i)}</div>`,
    )
    const art = splash ? SPLASH : []
    const fill = Math.max(3, art.length + 1)
    for (let i = 0; i < fill; i++)
      rows.push(
        `<div class="t-line t-vim-row">${c("blue", "~")}${art[i] ? `<span class="t-vim-splash">${art[i]}</span>` : ""}</div>`,
      )
    const ruler = `${row + 1},${col + 1}`
    rows.push(
      `<div class="t-line t-vim-status"><span>${status()}</span><span>` +
        `<button type="button" class="t-vim-esc" data-vim-key="Escape">esc</button>` +
        `${c("muted", ruler.padEnd(10))}All</span></div>`,
    )
    screen.innerHTML = rows.join("")
    term.scroll()
  }

  // ---------------------------------------------------------------- editing

  const snapshot = () => undo.push({ lines: [...lines], row, col })

  const change = () => {
    splash = false
    if (!modified && readonly && !warned) {
      warned = true
      message = c("red", "W10: Warning: Changing a readonly file")
    }
    modified = true
  }

  const fail = (html: string) => {
    attempts++
    message = html
    if (attempts === 5)
      message = c("yellow", "hint: escape, then colon, q, bang, enter. :q!")
  }

  const quit = () => {
    term.capture = undefined
    screen.remove()
    term.print(
      attempts === 0
        ? c("green", "you exited vim on the first try. impressive. 🏆")
        : c(
            "green",
            `you escaped vim after ${attempts} attempt${attempts === 1 ? "" : "s"}. put that on your résumé. ✨`,
          ),
    )
    term.renderPrompt()
    term.persist()
  }

  const word = (dir: 1 | -1) => {
    const text = lines[row]
    let i = col + dir
    const isWord = (ch?: string) => Boolean(ch && /\w/.test(ch))
    if (dir === 1) {
      while (i < text.length && isWord(text[i - 1]) && isWord(text[i])) i++
      while (i < text.length && text[i] === " ") i++
      if (i >= text.length && row < lines.length - 1) {
        row++
        return 0
      }
    } else {
      while (i > 0 && text[i] === " ") i--
      while (i > 0 && isWord(text[i - 1])) i--
    }
    return Math.max(0, Math.min(i, text.length))
  }

  const run = (input: string) => {
    const cmd = input.trim()
    mode = "normal"
    if (!cmd) return
    if (FORCE_QUIT.test(cmd)) return quit()
    if (QUIT.test(cmd)) {
      if (!modified) return quit()
      return fail(
        c("red", "E37: No write since last change (add ! to override)"),
      )
    }
    if (WRITE_QUIT.test(cmd) && /^x/.test(cmd) && !modified) return quit()
    if (/^w/.test(cmd) || WRITE_QUIT.test(cmd)) {
      if (!name) return fail(c("red", "E32: No file name"))
      if (cmd.includes("!"))
        return fail(
          c("red", `"${esc(name)}" E212: Can't open file for writing`),
        )
      return fail(c("red", "E45: 'readonly' option is set (add ! to override)"))
    }
    if (/^\d+$/.test(cmd)) {
      row = Number(cmd) - 1
      return clamp()
    }
    if (/^h(elp)?$/.test(cmd))
      return fail(c("muted", "E149: Sorry, no help for help. (it's :q!)"))
    if (/^(exit|quit|bye|leave)$/i.test(cmd))
      return fail(c("muted", "so close."))
    fail(c("red", `E492: Not an editor command: ${esc(cmd)}`))
  }

  // ------------------------------------------------------------------ keys

  const normal = (key: string) => {
    const combo = pending + key
    pending = ""
    message = recording ? message : ""
    switch (combo) {
      case "h":
      case "ArrowLeft":
      case "Backspace":
        col--
        break
      case "l":
      case "ArrowRight":
      case " ":
        col++
        break
      case "j":
      case "ArrowDown":
      case "Enter":
      case "+":
        row++
        break
      case "k":
      case "ArrowUp":
      case "-":
        row--
        break
      case "0":
      case "Home":
      case "^":
        col = 0
        break
      case "$":
      case "End":
        col = Number.POSITIVE_INFINITY
        break
      case "w":
      case "W":
      case "e":
        col = word(1)
        break
      case "b":
      case "B":
        col = word(-1)
        break
      case "gg":
        row = 0
        col = 0
        break
      case "G":
        row = lines.length - 1
        col = 0
        break
      case "i":
        mode = "insert"
        break
      case "a":
        mode = "insert"
        col++
        break
      case "I":
        mode = "insert"
        col = 0
        break
      case "A":
        mode = "insert"
        col = lines[row].length
        break
      case "o":
      case "O":
        snapshot()
        change()
        row += combo === "o" ? 1 : 0
        lines.splice(row, 0, "")
        col = 0
        mode = "insert"
        break
      case "x":
      case "Delete":
        if (!lines[row]) break
        snapshot()
        change()
        lines[row] = lines[row].slice(0, col) + lines[row].slice(col + 1)
        break
      case "dd":
        snapshot()
        change()
        lines.splice(row, 1)
        if (!lines.length) lines.push("")
        message =
          lines.length === 1 && !lines[0] ? "--No lines in buffer--" : ""
        break
      case "u":
        if (!undo.length) {
          message = "Already at oldest change"
          break
        }
        ;({ row, col } = undo[undo.length - 1])
        lines.splice(0, lines.length, ...(undo.pop()?.lines ?? [""]))
        modified = undo.length > 0
        message = "1 change; before #1"
        break
      case ":":
        mode = "command"
        command = ""
        break
      case "ZZ":
        return run("x")
      case "ZQ":
        return run("q!")
      case "q":
        if (recording) {
          recording = ""
          break
        }
        pending = "q"
        return
      case "C-c":
        fail(
          "Type  :qa!  and press &lt;Enter&gt; to abandon all changes and exit Vim",
        )
        break
      case "Escape":
        attempts++
        if (attempts === 5)
          message = c("yellow", "hint: escape, then colon, q, bang, enter. :q!")
        break
      case "g":
      case "d":
      case "Z":
        pending = combo
        return
      default:
        if (combo.startsWith("q") && /^q[a-z0-9]$/.test(combo)) {
          recording = combo[1]
          break
        }
        if (combo.length > 1 && combo.length <= 2) normal(key)
    }
    if (mode === "insert") splash = false
  }

  const insert = (key: string) => {
    const line = lines[row]
    message = ""
    if (key === "Escape" || key === "C-c" || key === "C-[") {
      mode = "normal"
      col--
      return
    }
    if (key === "ArrowLeft") col--
    else if (key === "ArrowRight") col++
    else if (key === "ArrowUp") row--
    else if (key === "ArrowDown") row++
    else if (key === "Enter") {
      snapshot()
      change()
      lines.splice(row, 1, line.slice(0, col), line.slice(col))
      row++
      col = 0
    } else if (key === "Backspace") {
      if (col > 0) {
        snapshot()
        change()
        lines[row] = line.slice(0, col - 1) + line.slice(col)
        col--
      } else if (row > 0) {
        snapshot()
        change()
        col = lines[row - 1].length
        lines[row - 1] += line
        lines.splice(row, 1)
        row--
      }
    } else if (key === "Tab" || key.length === 1) {
      snapshot()
      change()
      const text = key === "Tab" ? "  " : key
      lines[row] = line.slice(0, col) + text + line.slice(col)
      col += text.length
    }
  }

  const commandLine = (key: string) => {
    if (key === "Escape" || key === "C-c" || key === "C-[") mode = "normal"
    else if (key === "Enter") run(command)
    else if (key === "Backspace") {
      if (!command) mode = "normal"
      command = command.slice(0, -1)
    } else if (key.length === 1) command += key
  }

  const onKey = (key: string) => {
    if (key === "C-l") return true
    if (mode === "insert") insert(key)
    else if (mode === "command") commandLine(key)
    else normal(key)
    if (!term.capture) return true
    clamp()
    render()
    return true
  }

  // Phones have no Escape key, so the status line carries a tappable one.
  screen.addEventListener("click", (event) => {
    const key = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-vim-key]",
    )?.dataset.vimKey
    if (key) onKey(key)
  })

  term.capture = {
    prompt: "",
    handle: () => {},
    onKey,
  }
  term.renderPrompt()
  render()
}
