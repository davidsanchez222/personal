const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export const esc = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ENTITIES[ch])

/** Colored span: green, yellow, blue, magenta, cyan, red, muted, bold. */
export const c = (cls: string, text: string) =>
  `<span class="t-${cls}">${esc(text)}</span>`

/** A command the visitor can click to run. */
export const cmd = (command: string, label = command) =>
  `<button type="button" class="t-cmd" data-cmd="${esc(command)}">${esc(label)}</button>`

export const link = (href: string, label = href) =>
  /^https?:/.test(href)
    ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
    : `<a href="${esc(href)}">${esc(label)}</a>`

/** Escapes text, turning `backticked` spans into clickable commands. */
export const rich = (text: string) =>
  text
    .split(/`([^`]+)`/)
    .map((part, i) => (i % 2 ? cmd(part) : esc(part)))
    .join("")

export const pad = (text: string, width: number) =>
  text + " ".repeat(Math.max(0, width - [...text].length))

export const stripHtml = (html: string) => {
  const template = document.createElement("template")
  template.innerHTML = html
  return template.content.textContent ?? ""
}

export const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done) => {
    if (signal?.aborted) return done()
    const timer = setTimeout(done, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        done()
      },
      { once: true },
    )
  })

/** Resolves when the signal aborts (Ctrl+C or any key for screensavers). */
export const untilAborted = (signal: AbortSignal) =>
  new Promise<void>((done) => {
    if (signal.aborted) return done()
    signal.addEventListener("abort", () => done(), { once: true })
  })

export const storage = {
  get(store: Storage | undefined, key: string): string | null {
    try {
      return store?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  set(store: Storage | undefined, key: string, value: string | null) {
    try {
      if (value === null) store?.removeItem(key)
      else store?.setItem(key, value)
    } catch {}
  },
}

export function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j - 1], row[j])
      prev = tmp
    }
  }
  return row[b.length]
}
