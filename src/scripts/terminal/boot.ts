import { c, reducedMotion, sleep, storage } from "@/scripts/terminal/html"
import type { Terminal } from "@/scripts/terminal/shell"

export const BOOTED_KEY = "dsh.booted"

const stamp = (seconds: number) =>
  c("muted", `[${seconds.toFixed(6).padStart(12)}]`)
const ok = (text: string) => `[${c("green", "  OK  ")}] ${text}`

/** A fake systemd boot. Any key skips it; it only plays once per session. */
export async function boot(term: Terminal) {
  const { data } = term
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`
  const lines = [
    `${stamp(0)} Linux version 6.9.0-caffeinated (${data.prompt.user}@${data.prompt.host}) (astro) #1 SMP PREEMPT`,
    `${stamp(0.004211)} Command line: BOOT_IMAGE=/vmlinuz root=/dev/brain ro quiet splash`,
    `${stamp(0.112893)} Memory: 16384K/16384K available (mostly coffee)`,
    `${stamp(0.301442)} random: crng init done (entropy sourced from late-night ideas)`,
    ok(`Mounted ${c("bold", "/home/david")}.`),
    ok(
      `Started ${c("bold", "blog.service")}: ${plural(data.posts.length, "post")} indexed.`,
    ),
    ok(
      `Started ${c("bold", "projects.service")}: ${plural(data.projects.length, "project")} loaded.`,
    ),
    ok(
      `Started ${c("bold", "tags.service")}: ${plural(data.tags.length, "tag")}.`,
    ),
    ok(`Started ${c("bold", "vim.service")} (cannot be stopped).`),
    ok(`Reached target ${c("bold", "Portfolio")}.`),
  ]

  let skip = reducedMotion()
  term.setBusy(true)
  term.onKey = () => {
    skip = true
  }
  term.print(c("muted", "press any key to skip"))
  for (const line of lines) {
    term.print(line)
    if (!skip) await sleep(90 + Math.random() * 160)
  }
  if (!skip) {
    term.print()
    const login = term.print(`${data.prompt.host} login: `)
    for (const ch of data.prompt.user) {
      if (skip) break
      await sleep(110)
      login.append(ch)
    }
    if (!skip) await sleep(450)
  }
  term.onKey = undefined
  term.clear()
  storage.set(sessionStorage, BOOTED_KEY, "1")
  term.setBusy(false)
}
