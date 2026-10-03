import type { TermData } from "@/lib/terminal/types"
import {
  type FsDir,
  HOME,
  completePath,
  pathOf,
  prettyPath,
  resolve,
} from "@/scripts/terminal/fs"
import {
  c,
  esc,
  levenshtein,
  reducedMotion,
  sleep,
  storage,
  stripHtml,
} from "@/scripts/terminal/html"

export type Ctx = {
  term: Terminal
  name: string
  args: string[]
  raw: string
  signal: AbortSignal
  stdin?: string
}

export type Command = {
  name: string
  desc: string
  group: "about" | "now" | "files" | "system" | "fun"
  usage?: string
  aliases?: string[]
  hidden?: boolean
  run: (ctx: Ctx) => unknown
}

type Capture = {
  prompt: string
  secret?: boolean
  handle: (line: string) => void | Promise<void>
  interrupt?: () => void
}

type Elements = {
  body: HTMLElement
  out: HTMLElement
  prompt: HTMLElement
  ps1: HTMLElement
  before: HTMLElement
  cursor: HTMLElement
  after: HTMLElement
  input: HTMLInputElement
  title?: HTMLElement | null
}

const SESSION_KEY = "dsh.session"
const MAX_LINES = 400

export class Terminal {
  readonly el: Elements
  readonly data: TermData
  readonly root: FsDir
  readonly commands = new Map<string, Command>()
  cwd: FsDir
  prevCwd: FsDir
  history: string[] = []
  status = 0
  capture?: Capture
  /** The "program" (page) we handed off to, shown as a finished job on return. */
  job?: string
  /** Receives keydowns while a command is running (screensavers). */
  onKey?: (event: KeyboardEvent) => void

  private histIdx = -1
  private draft = ""
  private busy = false
  private abort?: AbortController
  private sink: string[] | null = null

  constructor(el: Elements, data: TermData, root: FsDir, commands: Command[]) {
    this.el = el
    this.data = data
    this.root = root
    for (const command of commands) {
      this.commands.set(command.name, command)
      for (const alias of command.aliases ?? [])
        this.commands.set(alias, command)
    }
    const home = resolve(root, root, HOME) as FsDir
    this.cwd = home
    this.prevCwd = home
    this.bind()
    this.renderPrompt()
  }

  // ---------------------------------------------------------------- output

  print(html = "", cls?: string): HTMLElement {
    const line = document.createElement("div")
    line.className = cls ? `t-line ${cls}` : "t-line"
    line.innerHTML = html
    if (this.sink) {
      this.sink.push(...stripHtml(html).split("\n"))
      return line
    }
    this.el.out.append(line)
    while (this.el.out.childElementCount > MAX_LINES)
      this.el.out.firstElementChild?.remove()
    this.scroll()
    return line
  }

  text(text: string, cls?: string) {
    return this.print(esc(text), cls)
  }

  error(text: string, status = 1) {
    this.status = status
    return this.print(c("red", text))
  }

  get capturing() {
    return this.sink !== null
  }

  /** Prints text one character at a time; any key finishes it instantly. */
  async type(html: string, signal: AbortSignal, speed = 12) {
    if (this.sink || reducedMotion()) return this.print(html)
    const line = this.print("")
    const template = document.createElement("template")
    template.innerHTML = html
    const nodes = [...template.content.childNodes]
    let skip = false
    const previous = this.onKey
    this.onKey = (event) => {
      if (!(event.ctrlKey && event.key === "c")) skip = true
    }
    for (const node of nodes) {
      if (node.nodeType !== Node.TEXT_NODE || skip || signal.aborted) {
        line.append(node)
        continue
      }
      const target = document.createTextNode("")
      line.append(target)
      for (const ch of node.textContent ?? "") {
        target.data += ch
        if (!skip && !signal.aborted && ch !== " ") {
          this.scroll()
          await sleep(speed, signal)
        }
      }
    }
    this.onKey = previous
    this.scroll()
    return line
  }

  clear() {
    this.el.out.replaceChildren()
  }

  scroll() {
    this.el.body.scrollTop = this.el.body.scrollHeight
  }

  ps1(dir = this.cwd) {
    const { user, host } = this.data.prompt
    return `${c("green", `${user}@${host}`)}${c("muted", ":")}${c("blue", prettyPath(pathOf(dir)))}${c("muted", "$")} `
  }

  // ------------------------------------------------------------- execution

  /** Runs a command line, echoing it like it was typed. */
  async exec(line: string, { echo = true } = {}) {
    if (this.busy || this.capture) return
    if (echo) this.print(this.ps1() + esc(line), "t-echo")
    const trimmed = line.trim()
    if (echo && trimmed) {
      if (this.history.at(-1) !== trimmed) this.history.push(trimmed)
      this.histIdx = -1
    }
    this.setBusy(true)
    this.abort = new AbortController()
    try {
      for (const { op, pipeline } of parse(trimmed)) {
        if (op === "&&" && this.status !== 0) break
        await this.runPipeline(pipeline, this.abort.signal)
        if (this.abort.signal.aborted) break
      }
    } catch (error) {
      this.error(`dsh: ${(error as Error).message}`)
    } finally {
      this.sink = null
      this.abort = undefined
      this.onKey = undefined
      this.setBusy(false)
      this.persist()
    }
  }

  private async runPipeline(pipeline: string[], signal: AbortSignal) {
    let stdin: string | undefined
    for (const [i, segment] of pipeline.entries()) {
      const last = i === pipeline.length - 1
      this.sink = last ? null : []
      await this.runOne(segment, signal, stdin)
      if (!last) stdin = (this.sink ?? []).join("\n").replace(/\n+$/, "")
    }
  }

  private async runOne(segment: string, signal: AbortSignal, stdin?: string) {
    const [name, ...args] = tokenize(segment, this)
    this.status = 0
    if (!name) return
    const command = this.commands.get(name)
    if (!command) return this.notFound(name)
    await command.run({ term: this, name, args, raw: segment, signal, stdin })
  }

  private notFound(name: string) {
    const visible = [...this.commands.keys()]
    const [best] = visible
      .map((candidate) => ({ candidate, d: levenshtein(name, candidate) }))
      .sort((a, b) => a.d - b.d)
    this.error(`dsh: command not found: ${name}`, 127)
    if (best && best.d <= 2)
      this.print(
        `${c("muted", "did you mean")} <button type="button" class="t-cmd" data-cmd="${esc(best.candidate)}">${esc(best.candidate)}</button>${c("muted", "?")}`,
      )
  }

  setCwd(dir: FsDir) {
    if (dir !== this.cwd) this.prevCwd = this.cwd
    this.cwd = dir
    this.renderPrompt()
  }

  /** Hands the page over to a "program" (a real page on the site). */
  async go(href: string, job: string, signal: AbortSignal, delay = 500) {
    this.print(
      `${c("muted", "launching")} ${c("yellow", job)}${c("muted", "…")}`,
    )
    await sleep(delay, signal)
    if (signal.aborted) return
    this.job = job
    this.persist()
    document.documentElement.classList.add("t-leaving")
    location.href = href
  }

  // ----------------------------------------------------------- persistence

  persist() {
    const lines = [...this.el.out.children].slice(-200)
    storage.set(
      sessionStorage,
      SESSION_KEY,
      JSON.stringify({
        html: lines.map((line) => line.outerHTML).join(""),
        history: this.history.slice(-100),
        cwd: pathOf(this.cwd),
        job: this.job,
      }),
    )
  }

  /** Restores the previous session, returning false when there was none. */
  restore(): boolean {
    const raw = storage.get(sessionStorage, SESSION_KEY)
    if (!raw) return false
    try {
      const session = JSON.parse(raw)
      this.el.out.innerHTML = session.html ?? ""
      this.history = session.history ?? []
      const dir = resolve(this.root, this.root, session.cwd ?? HOME)
      if (dir?.kind === "dir") this.setCwd(dir)
      if (session.job) this.finishJob(session.job)
      this.scroll()
      return true
    } catch {
      return false
    }
  }

  finishJob(job: string) {
    this.job = undefined
    document.documentElement.classList.remove("t-leaving")
    this.print(`${c("muted", "[1]+  Done")}                    ${esc(job)}`)
    this.persist()
  }

  forget() {
    storage.set(sessionStorage, SESSION_KEY, null)
  }

  // ----------------------------------------------------------------- input

  setBusy(busy: boolean) {
    this.busy = busy
    this.el.prompt.hidden = busy
    if (!busy) {
      this.renderPrompt()
      this.scroll()
    }
  }

  renderPrompt() {
    this.el.ps1.innerHTML = this.capture ? esc(this.capture.prompt) : this.ps1()
    if (this.el.title)
      this.el.title.textContent = `${this.data.prompt.user}@${this.data.prompt.host}: ${prettyPath(pathOf(this.cwd))}`
    this.renderLine()
  }

  private renderLine() {
    const { input, before, cursor, after } = this.el
    if (this.capture?.secret) {
      before.textContent = ""
      cursor.textContent = " "
      after.textContent = ""
      return
    }
    const value = input.value
    const pos = input.selectionStart ?? value.length
    before.textContent = value.slice(0, pos)
    cursor.textContent = value[pos] ?? " "
    after.textContent = value.slice(pos + 1)
  }

  private setInput(value: string) {
    this.el.input.value = value
    this.el.input.setSelectionRange(value.length, value.length)
    this.renderLine()
  }

  focus() {
    this.el.input.focus({ preventScroll: true })
  }

  private bind() {
    const { input, body, out } = this.el
    input.addEventListener("input", () => this.renderLine())
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === input) this.renderLine()
    })
    input.addEventListener("focus", () => body.classList.add("t-focused"))
    input.addEventListener("blur", () => body.classList.remove("t-focused"))
    input.addEventListener("keydown", (event) => this.onKeydown(event))

    body.addEventListener("click", (event) => {
      const target = event.target as HTMLElement
      const button = target.closest<HTMLElement>("[data-cmd]")
      if (button?.dataset.cmd) {
        this.focus()
        this.exec(button.dataset.cmd)
        return
      }
      if (target.closest("a")) return
      if (getSelection()?.isCollapsed !== false) this.focus()
    })

    // Screensavers and typewriters listen even when the input is not focused.
    document.addEventListener("keydown", (event) => {
      if (event.target === input) return
      if (this.busy) this.handleBusyKey(event)
      else if (
        event.key.length === 1 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !(event.target as HTMLElement).closest("input, textarea")
      )
        this.focus()
    })

    out.setAttribute("aria-live", "polite")
  }

  private handleBusyKey(event: KeyboardEvent) {
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault()
      this.interrupt()
      return
    }
    this.onKey?.(event)
  }

  interrupt(quiet = false) {
    if (!this.abort || this.abort.signal.aborted) return
    this.abort.abort()
    if (!quiet) this.print(c("muted", "^C"))
    document.documentElement.classList.remove("t-leaving")
  }

  private async onKeydown(event: KeyboardEvent) {
    const { input } = this.el
    const key = event.key

    if (this.busy) {
      event.preventDefault()
      this.handleBusyKey(event)
      return
    }

    if (event.ctrlKey && !event.metaKey) {
      const lower = key.toLowerCase()
      if (lower === "c") {
        event.preventDefault()
        if (this.capture?.interrupt) {
          this.print(esc(this.capture.prompt + input.value) + c("muted", "^C"))
          this.setInput("")
          this.capture.interrupt()
          return
        }
        this.print(this.ps1() + esc(input.value) + c("muted", "^C"), "t-echo")
        this.setInput("")
        this.capture = undefined
        this.renderPrompt()
        return
      }
      if (lower === "l") {
        event.preventDefault()
        this.clear()
        return
      }
      if (lower === "u") {
        event.preventDefault()
        this.setInput("")
        return
      }
    }

    if (key === "Enter") {
      event.preventDefault()
      const line = input.value
      this.setInput("")
      if (this.capture) {
        const capture = this.capture
        this.print(
          esc(capture.prompt) + (capture.secret ? "" : esc(line)),
          "t-echo",
        )
        this.setBusy(true)
        try {
          await capture.handle(line)
        } finally {
          this.setBusy(false)
          this.persist()
        }
        return
      }
      await this.exec(line)
      return
    }

    if (this.capture) return

    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault()
      if (this.history.length === 0) return
      if (this.histIdx === -1) this.draft = input.value
      const next =
        key === "ArrowUp"
          ? this.histIdx === -1
            ? this.history.length - 1
            : Math.max(0, this.histIdx - 1)
          : this.histIdx === -1
            ? -1
            : this.histIdx + 1
      if (next === -1 || next >= this.history.length) {
        this.histIdx = -1
        this.setInput(this.draft)
      } else {
        this.histIdx = next
        this.setInput(this.history[next])
      }
      return
    }

    if (key === "Tab") {
      event.preventDefault()
      this.complete()
    }
  }

  private complete() {
    const { input } = this.el
    const pos = input.selectionStart ?? input.value.length
    const head = input.value.slice(0, pos)
    const tail = input.value.slice(pos)
    const tokenStart =
      Math.max(head.lastIndexOf(" "), head.lastIndexOf("|")) + 1
    const partial = head.slice(tokenStart)
    const isCommand =
      head
        .slice(0, tokenStart)
        .trim()
        .replace(/[|;&]+$/, "") === "" ||
      /[|;&]\s*$/.test(head.slice(0, tokenStart))

    const matches = isCommand
      ? [
          ...new Set(
            [...this.commands.values()]
              .filter((cmd) => !cmd.hidden)
              .flatMap((cmd) => [cmd.name, ...(cmd.aliases ?? [])]),
          ),
        ]
          .filter((name) => name.startsWith(partial))
          .sort()
      : completePath(this.root, this.cwd, partial)

    if (matches.length === 0) return
    const common = matches.reduce((acc, match) => {
      let i = 0
      while (i < acc.length && acc[i] === match[i]) i++
      return acc.slice(0, i)
    })
    if (matches.length === 1) {
      const done = matches[0]
      const suffix = done.endsWith("/") ? "" : " "
      const value = head.slice(0, tokenStart) + done + suffix
      this.setInput(value + tail)
      input.setSelectionRange(value.length, value.length)
      this.renderLine()
      return
    }
    if (common.length > partial.length) {
      const value = head.slice(0, tokenStart) + common
      this.setInput(value + tail)
      input.setSelectionRange(value.length, value.length)
      this.renderLine()
      return
    }
    this.print(this.ps1() + esc(input.value), "t-echo")
    this.print(
      matches
        .map((match) =>
          match.endsWith("/")
            ? c("blue", match.split("/").at(-2) + "/")
            : esc(match.split("/").at(-1) ?? match),
        )
        .join("  "),
    )
  }
}

type Step = { op: ";" | "&&"; pipeline: string[] }

/** Splits a command line on `;`, `&&` and `|`, respecting quotes. */
export function parse(line: string): Step[] {
  const steps: Step[] = []
  let pipeline: string[] = []
  let current = ""
  let quote: string | null = null
  let op: Step["op"] = ";"
  const flush = () => {
    pipeline.push(current.trim())
    current = ""
  }
  const end = (next: Step["op"]) => {
    flush()
    if (pipeline.some(Boolean))
      steps.push({ op, pipeline: pipeline.filter(Boolean) })
    pipeline = []
    op = next
  }
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
      current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
    } else if (ch === "&" && line[i + 1] === "&") {
      end("&&")
      i++
    } else if (ch === ";") end(";")
    else if (ch === "|" && line[i + 1] !== "|") flush()
    else current += ch
  }
  end(";")
  return steps
}

/** Splits a command into words, expanding quotes, ~ and $VARIABLES. */
export function tokenize(segment: string, term: Terminal): string[] {
  const vars: Record<string, string> = {
    USER: term.data.prompt.user,
    HOME,
    PWD: pathOf(term.cwd),
    SHELL: "/bin/dsh",
    EDITOR: "vim",
    HOSTNAME: term.data.prompt.host,
    RANDOM: String(Math.floor(Math.random() * 32768)),
    "?": String(term.status),
  }
  const words: string[] = []
  let word = ""
  let started = false
  let quote: string | null = null
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i]
    if (quote) {
      if (ch === quote) quote = null
      else if (ch === "$" && quote === '"') {
        const match = /^\$(\?|\w+)/.exec(segment.slice(i))
        if (match) {
          word += vars[match[1]] ?? ""
          i += match[0].length - 1
        } else word += ch
      } else word += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (/\s/.test(ch)) {
      if (started) words.push(word)
      word = ""
      started = false
    } else if (ch === "$") {
      const match = /^\$(\?|\w+)/.exec(segment.slice(i))
      if (match) {
        word += vars[match[1]] ?? ""
        i += match[0].length - 1
      } else word += ch
      started = true
    } else {
      word += ch
      started = true
    }
  }
  if (started) words.push(word)
  return words
}
