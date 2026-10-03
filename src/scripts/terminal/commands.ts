import { getListening, startTicker } from "@/lib/now/live"
import {
  ago,
  bookList,
  dashboard,
  player,
  receipt,
  recent,
  shelf,
} from "@/lib/now/render"
import type { TermPost } from "@/lib/terminal/types"
import {
  FORTUNES,
  TUX,
  browserName,
  cava,
  cmatrix,
  cowsay,
  figlet,
  party,
  rainbow,
  sl,
} from "@/scripts/terminal/effects"
import {
  type FsDir,
  type FsFile,
  type FsNode,
  HOME,
  pathOf,
  prettyPath,
  resolve,
} from "@/scripts/terminal/fs"
import {
  c,
  cmd,
  esc,
  link,
  pad,
  rich,
  sleep,
  storage,
} from "@/scripts/terminal/html"
import type { Command, Ctx, Terminal } from "@/scripts/terminal/shell"

export const THEMES = [
  "frappe",
  "latte",
  "macchiato",
  "mocha",
  "dracula",
  "gruvbox",
  "nord",
  "solarized",
  "phosphor",
  "amber",
] as const

export const SESSION_START = "dsh.start"
const VERSION = "1.0.0"

// ------------------------------------------------------------------ helpers

const flags = (args: string[]) =>
  args
    .filter((arg) => /^-\w/.test(arg))
    .join("")
    .replaceAll("-", "")

const operands = (args: string[]) => args.filter((arg) => !/^-\w/.test(arg))

const shortDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })

const isoDay = (date: string | Date) =>
  new Date(date).toISOString().slice(0, 10)

const human = (bytes: number) =>
  bytes < 1024 ? `${bytes}` : `${(bytes / 1024).toFixed(1)}K`

const hash = (text: string) => {
  let h = 0x811c9dc5
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 7)
}

/** Catppuccin Frappé and Latte are the site's own dark and light modes. */
const currentTheme = () => {
  const root = document.documentElement
  return (
    root.dataset.termTheme ??
    (root.dataset.theme === "light" ? "latte" : "frappe")
  )
}

/** Runs a command line from inside another command (no echo or history). */
async function runLine(ctx: Ctx, line: string) {
  const [name, ...args] = line.split(" ")
  await ctx.term.commands.get(name)?.run({ ...ctx, name, args, raw: line })
}

const stamp = (date: Date) =>
  `${date.toLocaleString("en-US", { month: "short" })} ${String(date.getDate()).padStart(2, "0")} ${date.toTimeString().slice(0, 8)}`

const uptime = () => {
  const start = Number(storage.get(sessionStorage, SESSION_START)) || Date.now()
  const secs = Math.floor((Date.now() - start) / 1000)
  if (secs < 60) return `${secs} sec${secs === 1 ? "" : "s"}`
  const mins = Math.floor(secs / 60)
  return `${mins} min${mins === 1 ? "" : "s"}`
}

const relativeTo = (term: Terminal, node: FsNode, name: string) =>
  node.kind === "dir"
    ? prettyPath(pathOf(node))
    : prettyPath(`${pathOf(term.cwd)}/${name}`.replace(/^\/\//, "/"))

/** Renders a filesystem entry, clickable: dirs list themselves, files cat. */
function entry(node: FsNode, path: string) {
  if (node.kind === "dir")
    return cmd(`cd ${path} && ls`, `${node.name}/`).replace(
      'class="t-cmd"',
      'class="t-cmd t-dir"',
    )
  const cls = node.exec
    ? "t-cmd t-exec"
    : node.name.startsWith(".")
      ? "t-cmd t-hidden"
      : "t-cmd"
  const action = node.exec ? node.name : `cat ${path}`
  return cmd(action, node.name).replace('class="t-cmd"', `class="${cls}"`)
}

function lookup(ctx: Ctx, path: string): FsNode | undefined {
  const node = resolve(ctx.term.root, ctx.term.cwd, path)
  if (!node) ctx.term.error(`${ctx.name}: ${path}: No such file or directory`)
  return node
}

/** Where a post lives in the virtual filesystem (series get a directory). */
const postPath = (post: TermPost) =>
  post.subposts.length ? `~/blog/${post.id}/README.md` : `~/blog/${post.id}.md`

function readingTime(post: TermPost) {
  return Math.max(1, Math.round(post.words / 220))
}

function printPost(term: Terminal, file: FsFile, path: string) {
  const post = file.post as TermPost
  term.print(c("muted", "---"))
  term.print(`${c("cyan", "title:")} ${esc(post.title)}`)
  term.print(`${c("cyan", "date:")} ${isoDay(post.date)}`)
  if (post.tags.length)
    term.print(
      `${c("cyan", "tags:")} [${post.tags.map((tag) => cmd(`ls ~/tags/${tag}`, tag)).join(", ")}]`,
    )
  term.print(
    `${c("cyan", "words:")} ${post.words} ${c("muted", `(~${readingTime(post)} min read)`)}`,
  )
  if (post.subposts.length)
    term.print(`${c("cyan", "parts:")} ${post.subposts.length + 1}`)
  term.print(c("muted", "---"))
  term.print(esc(post.description))
  term.print()
  term.print(
    `${c("muted", "→")} ${cmd(`less ${path}`)} ${c("muted", "to read the whole thing")}`,
  )
}

// -------------------------------------------------------------------- vim

function vim(term: Terminal, lines: string[], name?: string) {
  let attempts = 0
  if (lines.length) {
    for (const line of lines) term.print(rich(line))
  } else {
    term.print(c("blue", "~"))
    term.print(
      `${c("blue", "~")}                 ${c("bold", "VIM - Vi IMproved")}`,
    )
    term.print(`${c("blue", "~")}                  version 9.1.0`)
    term.print(
      `${c("blue", "~")}         by Bram Moolenaar et al. (rest in peace, Bram)`,
    )
    term.print(c("blue", "~"))
    term.print(
      `${c("blue", "~")}      type  ${c("yellow", ":q<Enter>")}       to exit`,
    )
    term.print(
      `${c("blue", "~")}      ${c("muted", "(if only it were that easy)")}`,
    )
  }
  for (let i = 0; i < 3; i++) term.print(c("blue", "~"))
  term.print(
    c("muted", name ? `"${name}" [readonly] ${lines.length}L` : "[No Name]"),
  )

  const quit = () => {
    term.capture = undefined
    term.print(
      attempts === 0
        ? c("green", "you exited vim on the first try. impressive. 🏆")
        : c(
            "green",
            `you escaped vim after ${attempts} attempt${attempts === 1 ? "" : "s"}. put that on your résumé. ✨`,
          ),
    )
    term.renderPrompt()
  }

  term.capture = {
    prompt: "",
    handle(line) {
      const input = line.trim()
      if (/^(:(q|q!|qa!?|wq!?|wqa|x|quit)|ZZ|ZQ)$/.test(input)) return quit()
      attempts++
      if (input === "i" || input === "a")
        term.print(
          c("bold", "-- INSERT --") +
            c("muted", " …just kidding, this buffer is readonly."),
        )
      else if (input === ":help")
        term.print(c("muted", "E149: Sorry, no help for help. (it's :q)"))
      else if (input === ":w")
        term.print(
          c("red", "E45: 'readonly' option is set (add ! to override)"),
        )
      else if (input.startsWith(":"))
        term.print(c("red", `E492: Not an editor command: ${input.slice(1)}`))
      else if (/^(exit|quit|q|help|esc|escape)$/i.test(input))
        term.print(
          c(
            "muted",
            "nice try. you're in vim now. (psst: type :q and press Enter)",
          ),
        )
      else term.print(c("muted", "-- NORMAL --"))
      if (attempts === 5)
        term.print(c("yellow", "hint: colon. q. enter. you've got this."))
    },
    interrupt() {
      term.print(
        "Type  :qa!  and press <Enter> to abandon all changes and exit Vim",
      )
    },
  }
}

// --------------------------------------------------------------- commands

export function createCommands(): Command[] {
  const commands: Command[] = [
    {
      name: "help",
      desc: "list available commands",
      group: "system",
      aliases: ["?"],
      run({ term }) {
        const groups: [Command["group"], string][] = [
          ["about", "about me"],
          ["now", "right now"],
          ["files", "filesystem"],
          ["system", "system"],
        ]
        const visible = [...new Set(term.commands.values())]
        term.print(`${c("bold", "dsh")}, version ${VERSION} — david's shell`)
        term.print(
          c(
            "muted",
            "Click any command to run it. Tab completes, ↑/↓ walks history.",
          ),
        )
        for (const [group, label] of groups) {
          term.print()
          term.print(c("yellow", label))
          for (const command of visible.filter(
            (x) => x.group === group && !x.hidden,
          ))
            term.print(
              `  ${cmd(command.name)}${" ".repeat(Math.max(1, 12 - command.name.length))}${c("muted", command.desc)}`,
            )
        }
        const hidden = visible.filter((x) => x.hidden).length
        term.print()
        term.print(
          `${c("muted", `…plus ${hidden} hidden commands. Start with`)} ${cmd("cat ~/.secret", "cat .secret")}${c("muted", ".")}`,
        )
      },
    },
    {
      name: "whoami",
      desc: "who is david?",
      group: "about",
      async run({ term, signal }) {
        term.print(c("bold", term.data.prompt.user))
        if (term.capturing) {
          for (const line of term.data.whoami) term.print(rich(line))
          return
        }
        term.print()
        for (const line of term.data.whoami) {
          await term.type(rich(line), signal)
          if (signal.aborted) return
        }
      },
    },
    {
      name: "neofetch",
      desc: "system info, but it's me",
      group: "about",
      aliases: ["fastfetch"],
      run({ term }) {
        const { user, host } = term.data.prompt
        const theme = currentTheme()
        const info: [string, string][] = [
          [
            "OS",
            `dsh/Linux (${new URL(term.data.site.url, location.href).host})`,
          ],
          ["Host", "Astro static site"],
          ["Kernel", "curiosity-6.9.0-caffeinated"],
          ["Uptime", uptime()],
          [
            "Packages",
            `${term.data.posts.length} (blog), ${term.data.projects.length} (projects), ${term.data.tags.length} (tags)`,
          ],
          ["Shell", `dsh ${VERSION}`],
          ["Resolution", `${innerWidth}x${innerHeight}`],
          ["Terminal", browserName()],
          ["Theme", theme],
          ["Name", term.data.user.name],
        ]
        if (term.data.user.pronouns)
          info.push(["Pronouns", term.data.user.pronouns])
        if (term.data.user.bio) info.push(["Bio", term.data.user.bio])
        const { listening, reading, ate } = term.data.now
        info.push([
          "Music",
          `${listening.current.title} — ${listening.current.artist}`,
        ])
        const book = reading.find((b) => b.status === "reading")
        if (book) info.push(["Reading", book.title])
        if (ate[0]) info.push(["Last meal", ate[0].dish])

        const title = `${user}@${host}`
        const right = [
          `${c("green", user)}${c("muted", "@")}${c("green", host)}`,
          c("muted", "-".repeat(title.length)),
          ...info.map(
            ([key, value]) =>
              `${c("green", key)}${c("muted", ":")} ${esc(value)}`,
          ),
          "",
          ["red", "yellow", "green", "cyan", "blue", "magenta"]
            .map((color) => `<span class="t-swatch t-bg-${color}">   </span>`)
            .join(""),
        ]
        const rows = Math.max(TUX.length, right.length)
        for (let i = 0; i < rows; i++)
          term.print(
            `<span class="t-logo">${c("yellow", pad(TUX[i] ?? "", TUX[0].length))}</span>${right[i] ?? ""}`,
          )
      },
    },
    {
      name: "man",
      desc: "read the manual (try: man david)",
      group: "about",
      usage: "man <page>",
      async run({ term, args, signal }) {
        const [page] = args
        if (!page) {
          term.print("What manual page do you want?")
          term.print(`For example, try '${cmd("man david")}'.`)
          return
        }
        const { user } = term.data.prompt
        if (page === user || page === term.data.user.name.toLowerCase()) {
          const header = `${user.toUpperCase()}(1)`
          const title = "User Commands"
          const gap = " ".repeat(Math.max(2, 23 - title.length / 2))
          const indent = "       "
          const posts = term.data.posts.length
          term.print(c("bold", `${header}${gap}${title}${gap}${header}`))
          term.print()
          term.print(c("bold", "NAME"))
          term.print(
            `${indent}${esc(user)} - ${esc(term.data.user.bio ?? "human")}, terminal enthusiast`,
          )
          term.print()
          term.print(c("bold", "SYNOPSIS"))
          term.print(
            `${indent}${c("bold", user)} [${c("cyan", "--curious")}] [${c("cyan", "--caffeinated")}] [${c("cyan", "project")} ...]`,
          )
          term.print()
          term.print(c("bold", "DESCRIPTION"))
          for (const line of term.data.whoami.slice(0, 2))
            term.print(indent + rich(line), "t-indent")
          term.print()
          term.print(c("bold", "FILES"))
          term.print(
            `${indent}${cmd("ls ~/blog", "~/blog/")}       ${posts} post${posts === 1 ? "" : "s"} of long-form notes`,
          )
          term.print(
            `${indent}${cmd("ls ~/projects", "~/projects/")}   things I've built`,
          )
          term.print()
          term.print(c("bold", "SEE ALSO"))
          term.print(
            `${indent}${cmd("projects", "projects(1)")}, ${cmd("contact", "contact(1)")}, ${cmd("git log", "git-log(1)")}`,
          )
          term.print()
          term.print(
            c("muted", `${indent}The full manual is maintained as a blog.`),
          )
          await term.go("/blog", "less ~/blog", signal, 1600)
          return
        }
        if (page === "man") {
          term.print(
            `${c("bold", "man")} - an interface to the system reference manuals. You're using it. Try ${cmd("man david")}.`,
          )
          return
        }
        const command = term.commands.get(page)
        if (!command) {
          term.error(`No manual entry for ${page}`)
          return
        }
        term.print(c("bold", "NAME"))
        term.print(`       ${esc(command.name)} - ${esc(command.desc)}`)
        term.print(c("bold", "SYNOPSIS"))
        term.print(`       ${esc(command.usage ?? command.name)}`)
        if (command.aliases?.length) {
          term.print(c("bold", "ALIASES"))
          term.print(`       ${esc(command.aliases.join(", "))}`)
        }
      },
    },
    {
      name: "projects",
      desc: "things I've built",
      group: "about",
      run({ term }) {
        if (term.data.projects.length === 0) {
          term.print(c("muted", "~/projects is empty. (for now 👀)"))
          return
        }
        for (const project of term.data.projects) {
          const start = project.startDate
            ? isoDay(project.startDate).slice(0, 7)
            : ""
          const end = project.endDate
            ? isoDay(project.endDate).slice(0, 7)
            : "now"
          term.print(
            `${c("green", "●")} ${link(project.link, project.name)} ${start ? c("muted", `${start} → ${end}`) : ""}`,
          )
          term.print(`  ${esc(project.description)}`, "t-indent")
          if (project.tags.length)
            term.print(
              `  ${project.tags.map((tag) => c("cyan", `#${tag}`)).join(" ")}`,
            )
          term.print()
        }
        term.print(
          `${c("muted", "→")} ${link("/projects", "open ~/projects in the gui")}`,
        )
      },
    },
    {
      name: "blog",
      desc: "open the blog",
      group: "about",
      async run({ term, signal }) {
        await term.go("/blog", "less ~/blog", signal)
      },
    },
    {
      name: "contact",
      desc: "how to reach me",
      group: "about",
      aliases: ["socials"],
      run({ term }) {
        const width = Math.max(
          ...term.data.socials.map(({ label }) => label.length),
        )
        for (const { label, href } of term.data.socials)
          term.print(
            `${c("green", pad(label.toLowerCase(), width))}  ${link(href, href.replace(/^mailto:|^https?:\/\//, ""))}`,
          )
        if (term.data.user.mail)
          term.print(`\n${c("muted", "or just run")} ${cmd("mail")}`)
      },
    },
    {
      name: "mail",
      desc: "send me an email",
      group: "about",
      hidden: true,
      run({ term }) {
        const mail = term.data.user.mail
        if (!mail) return term.error("mail: no mailbox configured")
        term.print(
          `${c("muted", "opening your mail client for")} ${link(`mailto:${mail}`, mail)}`,
        )
        location.href = `mailto:${mail}`
      },
    },
    {
      name: "git",
      desc: "git log: everything I've shipped",
      group: "about",
      usage: "git <log|status|blame|push>",
      run({ term, args }) {
        const [sub = ""] = args
        if (sub === "log") {
          const commits = [
            ...term.data.posts.flatMap((post) => [
              {
                date: post.date,
                msg: `post: ${post.title}`,
                cmd: `cat ${postPath(post)}`,
                id: post.id,
              },
            ]),
            ...term.data.projects.map((project) => ({
              date: project.startDate ?? term.data.builtAt,
              msg: `feat: ${project.name}`,
              cmd: `cat ~/projects/${project.slug}.md`,
              id: project.slug,
            })),
          ].sort((a, b) => +new Date(b.date) - +new Date(a.date))
          commits.forEach((commit, i) => {
            const refs =
              i === 0
                ? ` ${c("yellow", "(")}${c("cyan", "HEAD -> ")}${c("green", "main")}${c("yellow", ")")}`
                : ""
            term.print(
              `${c("magenta", "*")} ${c("yellow", hash(commit.id))}${refs} ${cmd(commit.cmd, commit.msg)} ${c("muted", isoDay(commit.date))}`,
            )
          })
          term.print(
            `${c("magenta", "*")} ${c("yellow", hash("init"))} ${c("muted", "Initial commit (hello, world)")}`,
          )
          return
        }
        const replies: Record<string, string> = {
          status:
            "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean (unlike my real repos)",
          push: "Everything up-to-date",
          pull: "Already up to date.",
          commit: "On branch main\nnothing to commit, working tree clean",
          blame: `${hash("blame")} (${term.data.prompt.user} ${isoDay(new Date())}) it was me. it's always me.`,
          "--version": "git version 2.47.0 (dsh edition)",
        }
        if (sub in replies) term.text(replies[sub])
        else if (!sub)
          term.print(
            `usage: git [--version] &lt;command&gt;\n\ntry ${cmd("git log")}`,
          )
        else term.error(`git: '${sub}' is not a git command. See 'git --help'.`)
      },
    },

    // ------------------------------------------------------------ files
    {
      name: "ls",
      desc: "list directory contents",
      group: "files",
      usage: "ls [-la] [path]",
      aliases: ["dir"],
      run(ctx) {
        const { term, args } = ctx
        const opts = flags(args)
        const targets = operands(args)
        const all = opts.includes("a")
        const long = opts.includes("l")
        for (const [i, target] of (targets.length
          ? targets
          : ["."]
        ).entries()) {
          const node = lookup(ctx, target)
          if (!node) continue
          if (targets.length > 1) {
            if (i) term.print()
            term.print(`${esc(target)}:`)
          }
          const base = target === "." ? "" : `${target.replace(/\/$/, "")}/`
          if (node.kind === "file") {
            term.print(entry(node, target))
            continue
          }
          const children = [...node.children.values()]
            .filter((child) => all || !child.name.startsWith("."))
            .sort((a, b) => a.name.localeCompare(b.name))
          if (children.length === 0) continue
          if (!long) {
            term.print(
              children
                .map((child) => entry(child, base + child.name))
                .join("  "),
              "t-cols",
            )
            continue
          }
          term.print(`total ${children.length}`)
          for (const child of children) {
            const mode =
              child.kind === "dir"
                ? "drwxr-xr-x"
                : child.exec
                  ? "-rwxr-xr-x"
                  : "-rw-r--r--"
            const size = child.kind === "dir" ? "4.0K" : human(child.bytes)
            term.print(
              `${c("muted", mode)}  ${term.data.prompt.user}  staff  ${size.padStart(6)}  ${shortDate(child.mtime)}  ${entry(child, base + child.name)}${child.kind === "file" && child.post ? `  ${c("muted", `# ${child.post.title}`)}` : ""}`,
            )
          }
        }
      },
    },
    {
      name: "ll",
      desc: "ls -la",
      group: "files",
      hidden: true,
      run(ctx) {
        return ctx.term.commands
          .get("ls")
          ?.run({ ...ctx, args: ["-la", ...ctx.args] })
      },
    },
    {
      name: "cd",
      desc: "change directory",
      group: "files",
      usage: "cd [path]",
      run(ctx) {
        const { term, args } = ctx
        const target = args[0] ?? "~"
        const node = target === "-" ? term.prevCwd : lookup(ctx, target)
        if (!node) return
        if (node.kind !== "dir")
          return term.error(`cd: not a directory: ${target}`)
        term.setCwd(node)
      },
    },
    {
      name: "pwd",
      desc: "print working directory",
      group: "files",
      run({ term }) {
        term.text(pathOf(term.cwd))
      },
    },
    {
      name: "tree",
      desc: "the whole site, at a glance",
      group: "files",
      usage: "tree [-a] [path]",
      run(ctx) {
        const { term, args } = ctx
        const all = flags(args).includes("a")
        const target = operands(args)[0] ?? "."
        const node = lookup(ctx, target)
        if (!node) return
        let dirs = 0
        let files = 0
        term.print(c("blue", target))
        const walk = (dir: FsDir, prefix: string, path: string) => {
          const children = [...dir.children.values()]
            .filter((child) => all || !child.name.startsWith("."))
            .sort((a, b) => a.name.localeCompare(b.name))
          children.forEach((child, i) => {
            const last = i === children.length - 1
            const childPath = `${path}/${child.name}`
            term.print(
              `${c("muted", prefix + (last ? "└── " : "├── "))}${entry(child, childPath)}`,
            )
            if (child.kind === "dir") {
              dirs++
              walk(child, prefix + (last ? "    " : "│   "), childPath)
            } else files++
          })
        }
        if (node.kind === "dir")
          walk(node, "", target === "." ? "." : target.replace(/\/$/, ""))
        term.print()
        term.print(`${dirs} directories, ${files} files`)
      },
    },
    {
      name: "cat",
      desc: "print a file",
      group: "files",
      usage: "cat <file> ...",
      async run(ctx) {
        const { term, args, stdin } = ctx
        if (args.length === 0) {
          if (stdin !== undefined) term.text(stdin)
          else term.error("usage: cat <file> ...")
          return
        }
        for (const path of args) {
          const node = lookup(ctx, path)
          if (!node) continue
          if (node.kind === "dir") {
            term.error(`cat: ${path}: Is a directory`)
            continue
          }
          if (node.run) {
            await runLine(ctx, node.run)
            continue
          }
          if (node.exec) {
            term.print(`${c("muted", "ELF☐☐☐☐☐☐☐☐☐☐>☐☐☐☐☐@☐☐☐☐…")}`)
            term.error(`cat: ${path}: binary file (try running it instead)`)
          } else if (node.post) printPost(term, node, path)
          else if (node.project) {
            const { project } = node
            term.print(`${c("bold", "# ")}${c("bold", project.name)}`)
            term.print(esc(project.description))
            if (project.tags.length)
              term.print(
                project.tags.map((tag) => c("cyan", `#${tag}`)).join(" "),
              )
            term.print(`${c("muted", "→")} ${link(project.link)}`)
          } else
            for (const line of (node.text ?? "").split("\n"))
              term.print(rich(line))
        }
      },
    },
    {
      name: "less",
      desc: "read a post (or open any page)",
      group: "files",
      usage: "less <file>",
      aliases: ["more", "open", "xdg-open"],
      async run(ctx) {
        const { term, args, signal, stdin, name } = ctx
        const [target = "."] = args
        if (args.length === 0 && stdin !== undefined) {
          term.text(stdin)
          term.print(c("muted", "(END)"))
          return
        }
        if (args.length === 0 && name !== "open")
          return term.error(`usage: ${name} <file>`)
        const node = lookup(ctx, target)
        if (!node) return
        if (node.kind === "file" && node.run) return runLine(ctx, node.run)
        const { href } = node
        if (!href) {
          if (node.kind === "dir")
            return term.error(`${name}: ${target}: Is a directory`)
          for (const line of (node.text ?? "").split("\n"))
            term.print(rich(line))
          term.print(c("muted", "(END)"))
          return
        }
        if (/^https?:/.test(href)) {
          window.open(href, "_blank", "noopener")
          term.print(
            `${c("muted", "opened")} ${link(href)} ${c("muted", "in a new tab")}`,
          )
          return
        }
        await term.go(href, `${name} ${relativeTo(term, node, target)}`, signal)
      },
    },
    {
      name: "vim",
      desc: "the one true editor",
      group: "files",
      usage: "vim [file]",
      aliases: ["vi", "nvim"],
      async run(ctx) {
        const { term, args, signal, name } = ctx
        const [target] = args
        if (!target) return vim(term, [])
        const node = lookup(ctx, target)
        if (!node) return
        if (node.kind === "dir") return term.error(`"${target}" is a directory`)
        if (node.href && !/^https?:/.test(node.href)) {
          storage.set(sessionStorage, "dsh.vim", "1")
          await term.go(
            node.href,
            `${name} ${relativeTo(term, node, target)}`,
            signal,
          )
          return
        }
        vim(
          term,
          (node.text ?? node.project?.description ?? "").split("\n"),
          node.name,
        )
      },
    },
    {
      name: "grep",
      desc: "search posts and projects",
      group: "files",
      usage: "grep [-i] <pattern>",
      run({ term, args, stdin }) {
        const pattern = operands(args).join(" ")
        if (!pattern) return term.error("usage: grep [-i] <pattern>")
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const re = new RegExp(escaped, "gi")
        const mark = (text: string) =>
          esc(text).replace(
            new RegExp(esc(escaped), "gi"),
            (m) => `<mark>${m}</mark>`,
          )

        const matches = (text: string) => {
          re.lastIndex = 0
          return re.test(text)
        }

        if (stdin !== undefined) {
          const lines = stdin.split("\n").filter(matches)
          if (lines.length === 0) term.status = 1
          for (const line of lines) term.print(mark(line))
          return
        }

        let hits = 0
        const posts = term.data.posts.flatMap((post) => [
          post,
          ...post.subposts,
        ])
        for (const post of posts) {
          const match = [post.title, post.description, ...post.tags].find(
            matches,
          )
          if (!match) continue
          hits++
          const path = postPath(post)
          term.print(
            `${cmd(`cat ${path}`, path)}${c("muted", ":")} ${mark(match)}`,
          )
        }
        for (const project of term.data.projects) {
          const match = [
            project.name,
            project.description,
            ...project.tags,
          ].find(matches)
          if (!match) continue
          hits++
          term.print(
            `${cmd(`cat ~/projects/${project.slug}.md`, `~/projects/${project.slug}.md`)}${c("muted", ":")} ${mark(match)}`,
          )
        }
        if (hits === 0) {
          term.status = 1
          term.print(c("muted", `no matches for "${pattern}"`))
        }
      },
    },

    // ----------------------------------------------------------- system
    {
      name: "theme",
      desc: "change the color scheme",
      group: "system",
      usage: `theme <${THEMES.join("|")}>`,
      run({ term, args }) {
        const root = document.documentElement
        const current = currentTheme()
        const [choice] = args
        if (!choice) {
          for (const theme of THEMES)
            term.print(
              `${theme === current ? c("green", "*") : " "} ${cmd(`theme ${theme}`, theme)}`,
            )
          return
        }
        if (!(THEMES as readonly string[]).includes(choice))
          return term.error(
            `theme: unknown theme '${choice}'. try: ${THEMES.join(", ")}`,
          )
        if (choice === "frappe" || choice === "latte") {
          const mode = choice === "latte" ? "light" : "dark"
          delete root.dataset.termTheme
          root.dataset.theme = mode
          storage.set(localStorage, "termTheme", null)
          storage.set(localStorage, "theme", mode)
        } else {
          root.dataset.termTheme = choice
          storage.set(localStorage, "termTheme", choice)
        }
        term.print(
          `${c("muted", "theme set to")} ${c("green", choice)}${c("muted", ". it follows you to the blog, too.")}`,
        )
      },
    },
    {
      name: "clear",
      desc: "clear the screen (or Ctrl+L)",
      group: "system",
      aliases: ["cls"],
      run({ term }) {
        term.clear()
      },
    },
    {
      name: "history",
      desc: "commands you've run",
      group: "system",
      run({ term, args }) {
        if (args[0] === "-c") {
          term.history = []
          return
        }
        term.history.forEach((line, i) =>
          term.print(`${c("muted", String(i + 1).padStart(5))}  ${cmd(line)}`),
        )
      },
    },
    {
      name: "echo",
      desc: "print text",
      group: "system",
      run({ term, args }) {
        term.text(args.join(" "))
      },
    },
    {
      name: "date",
      desc: "print the date",
      group: "system",
      run({ term }) {
        term.text(new Date().toString())
      },
    },
    {
      name: "uname",
      desc: "print system information",
      group: "system",
      hidden: true,
      run({ term, args }) {
        term.text(
          flags(args).includes("a")
            ? `dsh ${term.data.prompt.host} 6.9.0-caffeinated #1 SMP ${new Date(term.data.builtAt).toUTCString()} astro GNU/Curiosity`
            : "dsh",
        )
      },
    },
    {
      name: "uptime",
      desc: "how long you've been here",
      group: "system",
      hidden: true,
      run({ term }) {
        const time = new Date().toTimeString().slice(0, 8)
        term.text(
          ` ${time} up ${uptime()},  1 user,  load average: 0.42, 0.13, 0.37`,
        )
      },
    },
    {
      name: "exit",
      desc: "end the session",
      group: "system",
      aliases: ["logout"],
      async run({ term, signal }) {
        term.print("logout")
        term.print()
        term.print("Saving session...")
        await sleep(400, signal)
        term.print("...completed.")
        term.print()
        term.print(c("muted", "[Process completed]"))
        term.print(c("muted", "press any key to open a new session"))
        term.forget()
        await new Promise<void>((done) => {
          term.onKey = () => done()
          signal.addEventListener("abort", () => done(), { once: true })
          term.el.body.addEventListener("click", () => done(), { once: true })
        })
        term.clear()
        await term.commands
          .get("motd")
          ?.run({ term, name: "motd", args: [], raw: "motd", signal })
      },
    },
    {
      name: "reboot",
      desc: "replay the boot sequence",
      group: "system",
      aliases: ["shutdown"],
      async run({ term, signal }) {
        term.print(
          c(
            "yellow",
            "Broadcast message from david@portfolio: The system is going down for reboot NOW!",
          ),
        )
        await sleep(700, signal)
        if (signal.aborted) return
        term.forget()
        storage.set(sessionStorage, "dsh.booted", null)
        location.reload()
      },
    },

    // -------------------------------------------------------------- fun
    {
      name: "sudo",
      desc: "become root",
      group: "fun",
      hidden: true,
      run({ term, args }) {
        if (args.length === 0) return term.error("usage: sudo <command>")
        if (args.join(" ") === "make me a sandwich") {
          term.print("okay. 🥪")
          return
        }
        let attempts = 0
        term.capture = {
          prompt: `[sudo] password for ${term.data.prompt.user}: `,
          secret: true,
          handle() {
            attempts++
            if (attempts < 3) {
              term.print("Sorry, try again.")
              return
            }
            term.capture = undefined
            term.print("sudo: 3 incorrect password attempts")
            term.error(
              `${term.data.prompt.user} is not in the sudoers file. This incident will be reported.`,
            )
            term.print(c("muted", "(yes, even on my own website.)"))
          },
          interrupt() {
            term.capture = undefined
            term.renderPrompt()
          },
        }
      },
    },
    {
      name: "rm",
      desc: "remove files",
      group: "fun",
      hidden: true,
      async run({ term, args, signal }) {
        const opts = flags(args)
        const [target] = operands(args)
        if (!target) return term.error("usage: rm [-rf] file ...")
        const nuke =
          opts.includes("r") &&
          ["/", "/*", "~", "~/", "*", ".", "~/*"].includes(target)
        if (!nuke)
          return term.error(
            `rm: cannot remove '${target}': Read-only file system (nice try)`,
          )
        const paths: string[] = []
        const walk = (dir: FsDir) => {
          for (const child of dir.children.values()) {
            if (child.kind === "dir") walk(child)
            else
              paths.push(`${pathOf(dir)}/${child.name}`.replace(/^\/\//, "/"))
          }
        }
        walk(
          target.startsWith("/")
            ? term.root
            : (resolve(term.root, term.root, HOME) as FsDir),
        )
        for (const path of paths) {
          if (signal.aborted) return
          term.print(c("muted", `removed '${path}'`))
          await sleep(25, signal)
        }
        const root = document.documentElement
        root.classList.add("t-glitch")
        await sleep(1200)
        root.classList.remove("t-glitch")
        term.clear()
        term.print(
          c(
            "red",
            "Kernel panic - not syncing: Attempted to kill the portfolio!",
          ),
        )
        await sleep(1400)
        term.print()
        term.print(
          `…just kidding. it's a static site, you can't hurt it. ${c("green", "everything's fine.")} 💚`,
        )
        term.print(c("muted", "(please don't do that on your real machine)"))
      },
    },
    {
      name: "cmatrix",
      desc: "enter the matrix",
      group: "fun",
      hidden: true,
      async run({ term, signal }) {
        term.print(c("muted", "press any key to exit"))
        await cmatrix(term, signal)
      },
    },
    {
      name: "sl",
      desc: "you meant ls",
      group: "fun",
      hidden: true,
      async run({ term }) {
        await sl(term)
      },
    },
    {
      name: "cowsay",
      desc: "a cow says things",
      group: "fun",
      hidden: true,
      run({ term, args, stdin }) {
        const text = args.join(" ") || stdin || "moo. try `fortune | cowsay`"
        term.print(esc(cowsay(text)), "t-pre")
      },
    },
    {
      name: "fortune",
      desc: "a random quote",
      group: "fun",
      hidden: true,
      run({ term }) {
        term.text(FORTUNES[Math.floor(Math.random() * FORTUNES.length)])
      },
    },
    {
      name: "lolcat",
      desc: "rainbows",
      group: "fun",
      hidden: true,
      run({ term, args, stdin }) {
        const text = stdin ?? args.join(" ")
        if (!text) return term.error("usage: <command> | lolcat")
        text.split("\n").forEach((line, i) => term.print(rainbow(line, i * 12)))
      },
    },
    {
      name: "wc",
      desc: "count words",
      group: "fun",
      hidden: true,
      run({ term, stdin = "" }) {
        const lines = stdin ? stdin.split("\n").length : 0
        const words = stdin.split(/\s+/).filter(Boolean).length
        term.text(
          `${String(lines).padStart(8)}${String(words).padStart(8)}${String(stdin.length).padStart(8)}`,
        )
      },
    },
    {
      name: "head",
      desc: "first lines",
      group: "fun",
      hidden: true,
      run({ term, args, stdin = "" }) {
        const n = Number(args[args.indexOf("-n") + 1]) || 10
        term.text(stdin.split("\n").slice(0, n).join("\n"))
      },
    },
    {
      name: "tail",
      desc: "last lines",
      group: "fun",
      hidden: true,
      run({ term, args, stdin = "" }) {
        const n = Number(args[args.indexOf("-n") + 1]) || 10
        term.text(stdin.split("\n").slice(-n).join("\n"))
      },
    },
    {
      name: "yes",
      desc: "y",
      group: "fun",
      hidden: true,
      async run({ term, args, signal }) {
        const word = args.join(" ") || "y"
        for (let i = 0; i < 5000 && !signal.aborted; i++) {
          term.text(word)
          await sleep(16, signal)
        }
      },
    },
    {
      name: "coffee",
      desc: "brew coffee",
      group: "fun",
      hidden: true,
      aliases: ["brew"],
      async run({ term, signal }) {
        const bar = term.print("")
        for (let i = 0; i <= 20; i++) {
          if (signal.aborted) return
          bar.innerHTML = `${c("muted", "brewing")} [${c("yellow", "#".repeat(i))}${".".repeat(20 - i)}] ${i * 5}%`
          await sleep(70, signal)
        }
        term.print(
          esc(
            [
              "    ( (",
              "     ) )",
              "  ........",
              "  |      |]",
              "  \\      /",
              "   `----'",
            ].join("\n"),
          ),
          "t-pre t-yellow",
        )
        term.print("here's your coffee. ☕ (HTTP 418 narrowly avoided)")
      },
    },
    {
      name: "ping",
      desc: "are you there?",
      group: "fun",
      hidden: true,
      async run({ term, args, signal }) {
        const host = args[0] ?? term.data.prompt.user
        term.text(`PING ${host} (127.0.0.1): 56 data bytes`)
        const times: number[] = []
        for (let seq = 0; seq < 4 && !signal.aborted; seq++) {
          const time = 0.2 + Math.random() * 0.6
          times.push(time)
          term.text(
            `64 bytes from ${host}: icmp_seq=${seq} ttl=64 time=${time.toFixed(3)} ms`,
          )
          await sleep(600, signal)
        }
        term.print()
        term.text(`--- ${host} ping statistics ---`)
        term.text(
          `${times.length} packets transmitted, ${times.length} packets received, 0.0% packet loss`,
        )
        if (host === term.data.prompt.user)
          term.print(
            `${c("muted", "(very responsive. say hi:")} ${cmd("contact")}${c("muted", ")")}`,
          )
      },
    },
    {
      name: "nano",
      desc: "an editor",
      group: "fun",
      hidden: true,
      run({ term }) {
        term.print(
          `nano? on ${term.data.prompt.user}'s machine? try ${cmd("vim")}.`,
        )
      },
    },
    {
      name: "emacs",
      desc: "an operating system",
      group: "fun",
      hidden: true,
      run({ term }) {
        term.print(
          `emacs: a great operating system, lacking only a decent editor. try ${cmd("vim")}.`,
        )
      },
    },
    {
      name: "hello",
      desc: "hi!",
      group: "fun",
      hidden: true,
      aliases: ["hi", "hey"],
      run({ term }) {
        term.print(
          `hi! 👋 I'm ${esc(term.data.user.name)}. try ${cmd("whoami")} or ${cmd("help")}.`,
        )
      },
    },
    {
      name: "konami",
      desc: "↑↑↓↓←→←→ba",
      group: "fun",
      hidden: true,
      run({ term }) {
        party()
        term.print(rainbow("★ +30 lives. cheat mode enabled. ★"))
      },
    },
    // -------------------------------------------------------------- now
    {
      name: "now",
      desc: "what I'm up to, in tmux",
      group: "now",
      aliases: ["dashboard"],
      async run({ term }) {
        const { user, host } = term.data.prompt
        const listening = await getListening(term.data.now)
        if (term.capturing) {
          term.text(
            `music: ${listening.current.title} — ${listening.current.artist}`,
          )
          const book = term.data.now.reading.find((b) => b.status === "reading")
          if (book) term.text(`books: ${book.title} — ${book.author}`)
          if (term.data.now.ate[0])
            term.text(
              `food: ${term.data.now.ate[0].dish} @ ${term.data.now.ate[0].place}`,
            )
          return
        }
        const date = new Date()
        const time = `${date.toTimeString().slice(0, 5)} ${String(date.getDate()).padStart(2, "0")}-${date.toLocaleString("en-US", { month: "short" })}-${String(date.getFullYear()).slice(2)}`
        term.print(
          dashboard(term.data.now, {
            action: (command, label) => cmd(command, label),
            listening,
            relative: true,
            host: `${user}@${host}`,
            time,
          }),
        )
        term.print(
          `${c("muted", "[detached from session now]")} ${c("muted", "· click a pane title to zoom in · gui version:")} ${link("/now", "~/now ↗")}`,
        )
        startTicker()
      },
    },
    {
      name: "np",
      desc: "what I'm listening to",
      group: "now",
      aliases: ["nowplaying", "music", "spotify"],
      async run({ term }) {
        const loading = term.data.now.lastfm
          ? term.print(
              c(
                "muted",
                `♪ asking last.fm what ${term.data.prompt.user} is playing…`,
              ),
            )
          : undefined
        const listening = await getListening(term.data.now)
        loading?.remove()
        const { current } = listening
        if (term.capturing) {
          term.text(`${current.title} — ${current.artist}`)
          return
        }
        term.print(player(current, listening))
        if (listening.recent.length) {
          term.print(c("muted", "recently played:"))
          term.print(recent(listening.recent))
        }
        term.print(
          `${c("muted", "try")} ${cmd("cava")} ${c("muted", "for the visualizer, or")} ${cmd("np | cowsay")}`,
        )
        startTicker()
      },
    },
    {
      name: "reading",
      desc: "my bookshelf",
      group: "now",
      aliases: ["books", "goodreads"],
      run({ term }) {
        const books = term.data.now.reading
        if (books.length === 0)
          return term.print(
            c("muted", "the shelf is empty. recommendations welcome."),
          )
        if (term.capturing) {
          for (const book of books)
            term.text(`${book.status}: ${book.title} — ${book.author}`)
          return
        }
        term.print(shelf(books))
        term.print(bookList(books))
        term.print()
        term.print(c("muted", "(the cat is not for sale.)"))
      },
    },
    {
      name: "ate",
      desc: "where I last ate",
      group: "now",
      aliases: ["food", "lastmeal", "hungry"],
      run({ term }) {
        const meals = term.data.now.ate
        const [meal] = meals
        if (!meal)
          return term.print(
            c("muted", "stomach.service: inactive (dead). nothing logged yet."),
          )
        if (term.capturing) {
          term.text(
            `${meal.dish} @ ${meal.place} (${ago(new Date(meal.date))})`,
          )
          return
        }
        term.print(receipt(meal, 41 + meals.length, true))
        if (meals.length > 1)
          term.print(
            `${c("muted", "full history:")} ${cmd("journalctl -u stomach")}`,
          )
      },
    },
    {
      name: "journalctl",
      desc: "system logs",
      group: "now",
      hidden: true,
      usage: "journalctl -u stomach",
      run({ term, args }) {
        const unit = args[args.indexOf("-u") + 1] ?? ""
        if (!/^stomach(\.service)?$/.test(unit)) {
          term.print(c("muted", "-- No entries --"))
          term.print(`${c("muted", "hint:")} ${cmd("journalctl -u stomach")}`)
          return
        }
        const meals = [...term.data.now.ate].sort(
          (a, b) => +new Date(a.date) - +new Date(b.date),
        )
        if (meals.length === 0)
          return term.print(c("muted", "-- No entries --"))
        const first = new Date(meals[0].date)
        const last = new Date(meals.at(-1)?.date ?? meals[0].date)
        term.print(
          c(
            "muted",
            `-- Logs begin at ${first.toDateString()}, end at ${last.toDateString()}. --`,
          ),
        )
        const unitTag = `${term.data.prompt.host} ${c("cyan", "stomach[1337]")}:`
        for (const meal of meals) {
          const date = new Date(meal.date)
          const prefix = `${c("muted", stamp(date))} ${unitTag}`
          term.print(
            `${prefix} Started digesting ${c("bold", `"${meal.dish}"`)} from ${esc(meal.place)}.`,
          )
          if (meal.rating)
            term.print(
              `${prefix} rating=${c("yellow", "★".repeat(meal.rating) + "☆".repeat(5 - meal.rating))}`,
            )
          if (meal.note)
            term.print(`${prefix} ${c("muted", `note: ${meal.note}`)}`)
          if ((meal.rating ?? 5) <= 2)
            term.print(
              `${prefix} ${c("red", "stomach.service: Main process exited, code=exited, status=1/FAILURE")}`,
            )
        }
      },
    },
    {
      name: "tmux",
      desc: "terminal multiplexer",
      group: "now",
      hidden: true,
      async run(ctx) {
        const { term, args } = ctx
        const [sub = "attach"] = args
        if (["attach", "a", "attach-session", "at"].includes(sub))
          return runLine(ctx, "now")
        if (sub === "ls" || sub === "list-sessions")
          return term.text(
            `now: 3 windows (created ${new Date(term.data.now.updated).toDateString()}) (attached)`,
          )
        if (sub === "new" || sub === "new-session")
          return term.error(
            "sessions should be nested with care, unset $TMUX to force",
          )
        if (sub === "kill-server")
          return term.print("nice try. the server is static.")
        term.error(`unknown command: ${sub}`)
      },
    },
    {
      name: "cava",
      desc: "audio visualizer",
      group: "now",
      hidden: true,
      async run({ term, signal }) {
        const { current } = await getListening(term.data.now)
        term.print(c("muted", "press any key to exit"))
        await cava(term, signal, `♪ ${current.title} — ${current.artist}`)
      },
    },
    {
      name: "motd",
      desc: "message of the day",
      group: "system",
      hidden: true,
      run({ term }) {
        const banner = figlet(term.data.prompt.user)
        if (banner) term.print(c("green", banner), "t-pre t-banner")
        else term.print(c("bold", term.data.user.name))
        term.print()
        term.print(
          `Welcome to ${c("bold", term.data.site.title)}'s home directory. ${c("muted", `(dsh ${VERSION})`)}`,
        )
        const last = storage.get(localStorage, "dsh.lastLogin")
        term.print(
          c(
            "muted",
            last
              ? `Last login: ${new Date(last).toString().slice(0, 24)} on ttys001`
              : "First login detected. Welcome aboard! 🎉",
          ),
        )
        storage.set(localStorage, "dsh.lastLogin", new Date().toISOString())
        term.print()
        const { listening, reading, ate } = term.data.now
        const book = reading.find((b) => b.status === "reading")
        const strip = term.print(
          [
            `${c("magenta", "♪")} ${cmd("np", `${listening.current.title} — ${listening.current.artist}`)}`,
            book ? `${c("peach", "📖")} ${cmd("reading", book.title)}` : "",
            ate[0] ? `${c("peach", "🍽")} ${cmd("ate", ate[0].dish)}` : "",
          ]
            .filter(Boolean)
            .join("   "),
          "t-strip",
        )
        if (term.data.now.lastfm)
          getListening(term.data.now).then(({ current }) => {
            const button = strip.querySelector('[data-cmd="np"]')
            if (button)
              button.textContent = `${current.title} — ${current.artist}`
          })
        term.print()
        term.print(
          `Type ${cmd("help")} to get started, or try ${cmd("whoami")}, ${cmd("now")}, ${cmd("ls")} or ${cmd(`man ${term.data.prompt.user}`)}.`,
        )
        term.print(
          c("muted", "Prefer a normal website? ") + link("/blog", "gui mode →"),
        )
        term.print()
      },
    },
  ]
  return commands
}

export const commandNames = (commands: Command[]) =>
  [
    ...new Set(
      commands.flatMap((command) => [command.name, ...(command.aliases ?? [])]),
    ),
  ]
    .filter((name) => /^[a-z]/.test(name))
    .sort()
