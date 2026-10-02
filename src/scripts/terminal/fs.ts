import type { TermData, TermPost, TermProject } from "@/lib/terminal/types"

export type FsFile = {
  kind: "file"
  name: string
  bytes: number
  mtime: Date
  href?: string
  text?: string
  post?: TermPost
  project?: TermProject
  exec?: boolean
}

export type FsDir = {
  kind: "dir"
  name: string
  parent?: FsDir
  href?: string
  mtime: Date
  children: Map<string, FsNode>
}

export type FsNode = FsFile | FsDir

export const HOME = "/home/david"

const dir = (name: string, parent?: FsDir, href?: string): FsDir => {
  const node: FsDir = {
    kind: "dir",
    name,
    parent,
    href,
    mtime: new Date(),
    children: new Map(),
  }
  parent?.children.set(name, node)
  return node
}

const file = (
  parent: FsDir,
  node: Omit<FsFile, "kind" | "bytes" | "mtime"> & Partial<FsFile>,
) => {
  const full: FsFile = {
    kind: "file",
    bytes: node.text?.length ?? 0,
    mtime: new Date(),
    ...node,
  }
  parent.children.set(full.name, full)
  return full
}

const postFile = (parent: FsDir, post: TermPost, name = `${post.slug}.md`) =>
  file(parent, {
    name,
    bytes: post.bytes,
    mtime: new Date(post.date),
    href: post.url,
    post,
  })

export function buildFs(data: TermData, commands: string[]): FsDir {
  const root = dir("")
  const home = dir("david", dir("home", root))

  const etc = dir("etc", root)
  file(etc, { name: "hostname", text: data.prompt.host })
  file(etc, {
    name: "motd",
    text: `Welcome to ${data.site.title}'s corner of the internet.\nType 'help' to get started.`,
  })
  file(etc, {
    name: "shells",
    text: "/bin/sh\n/bin/bash\n/bin/zsh\n/bin/dsh  # the best one",
  })

  const bin = dir("bin", root)
  for (const name of commands)
    file(bin, { name, bytes: 8192 + name.length * 512, exec: true })

  const dev = dir("dev", root)
  file(dev, { name: "null", text: "" })
  file(dev, { name: "coffee", text: "☕ the device is busy. try `coffee`." })
  dir("tmp", root)

  file(home, {
    name: "about.txt",
    text: [data.user.name, "", ...data.whoami].join("\n"),
  })
  file(home, {
    name: "contact.txt",
    text: data.socials.map(({ label, href }) => `${label}: ${href}`).join("\n"),
  })
  file(home, {
    name: ".bashrc",
    text: [
      "# ~/.bashrc: executed by dsh(1) for interactive shells.",
      "",
      'export EDITOR="vim"   # there is no other way',
      'export PAGER="less"',
      "",
      "alias ll='ls -la'",
      "alias please='sudo'",
      "alias yolo='git push --force'   # (not really)",
      "alias blog='man david'",
      "",
      "fortune | cowsay",
    ].join("\n"),
  })
  file(home, {
    name: ".secret",
    text: [
      "You found the secret file. 🎉",
      "",
      "Here are some more things to try:",
      "  `sudo rm -rf /`  `cmatrix`  `sl`  `vim`  `fortune | cowsay`",
      "  …and the Konami code: ↑ ↑ ↓ ↓ ← → ← → b a",
    ].join("\n"),
  })

  const blog = dir("blog", home, "/blog")
  for (const post of data.posts) {
    if (post.subposts.length === 0) {
      postFile(blog, post)
      continue
    }
    const series = dir(post.slug, blog, post.url)
    series.mtime = new Date(post.date)
    postFile(series, post, "README.md")
    for (const sub of post.subposts) postFile(series, sub)
  }

  const projects = dir("projects", home, "/projects")
  for (const project of data.projects)
    file(projects, {
      name: `${project.slug}.md`,
      bytes: project.description.length,
      mtime: project.startDate ? new Date(project.startDate) : new Date(),
      href: project.link,
      project,
    })

  const tags = dir("tags", home, "/tags")
  const byId = new Map(data.posts.map((post) => [post.id, post]))
  for (const tag of data.tags) {
    const tagDir = dir(tag.name, tags, `/tags/${tag.name}`)
    for (const id of tag.posts) {
      const post = byId.get(id)
      if (post) postFile(tagDir, post)
    }
  }

  return root
}

export const pathOf = (node: FsDir): string => {
  const parts: string[] = []
  for (let cur: FsDir | undefined = node; cur?.parent; cur = cur.parent)
    parts.unshift(cur.name)
  return `/${parts.join("/")}`
}

export const prettyPath = (path: string) =>
  path === HOME
    ? "~"
    : path.startsWith(`${HOME}/`)
      ? `~${path.slice(HOME.length)}`
      : path

export function resolve(
  root: FsDir,
  cwd: FsDir,
  input: string,
): FsNode | undefined {
  let path = input.trim()
  if (path === "" || path === "~") path = HOME
  else if (path.startsWith("~/")) path = HOME + path.slice(1)

  let node: FsNode = path.startsWith("/") ? root : cwd
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue
    if (node.kind !== "dir") return undefined
    if (part === "..") {
      node = node.parent ?? node
      continue
    }
    const next: FsNode | undefined = node.children.get(part)
    if (!next) return undefined
    node = next
  }
  return node
}

// Completes the last path segment of `partial` relative to `cwd`.
export function completePath(
  root: FsDir,
  cwd: FsDir,
  partial: string,
): string[] {
  const slash = partial.lastIndexOf("/")
  const base = slash >= 0 ? partial.slice(0, slash + 1) : ""
  const prefix = slash >= 0 ? partial.slice(slash + 1) : partial
  const parent = base ? resolve(root, cwd, base) : cwd
  if (!parent || parent.kind !== "dir") return []
  return [...parent.children.values()]
    .filter(
      (child) =>
        child.name.startsWith(prefix) &&
        (prefix.startsWith(".") || !child.name.startsWith(".")),
    )
    .map((child) => base + child.name + (child.kind === "dir" ? "/" : ""))
}
