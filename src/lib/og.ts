// Build-time link-preview images (Open Graph): a Frappé terminal window
// showing the "command" behind each page, rendered with satori + resvg.
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { Resvg } from "@resvg/resvg-js"
import { getCollection, getEntry } from "astro:content"
import satori from "satori"
import { SITE, TERMINAL } from "@/consts"
import { NOW } from "@/data/now"
import { getPosts, getSubposts, getTags } from "@/lib/content"
import { normalizePath } from "@/lib/utils"

export type OgCard = {
  slug: string
  cwd: string
  command: string
  title: string
  meta: string[]
}

export const ogSlug = (pathname: string) =>
  normalizePath(pathname).replace(/^\//, "") || "index"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** One card per page that has a meta image. */
export async function getOgCards(): Promise<OgCard[]> {
  const [posts, series, tags, authors, projects, me] = await Promise.all([
    getPosts(),
    getSubposts(),
    getTags(),
    getCollection("authors"),
    getCollection("projects"),
    getEntry("authors", TERMINAL.author),
  ])
  const reading = NOW.reading.find((book) => book.status === "reading")
  const cards: OgCard[] = [
    {
      slug: "index",
      cwd: "~",
      command: "whoami",
      title: SITE.title,
      meta: [me?.data.bio ?? "", "terminal enthusiast"].filter(Boolean),
    },
    {
      slug: "blog",
      cwd: "~/blog",
      command: "ls -lt",
      title: "blog",
      meta: [plural(posts.length, "post"), "notes on things I build"],
    },
    {
      slug: "now",
      cwd: "~",
      command: "tmux attach -t now",
      title: "what I'm up to now",
      meta: [
        `listening to ${NOW.listening.current.artist}`,
        ...(reading ? [`reading ${reading.title}`] : []),
      ],
    },
    {
      slug: "projects",
      cwd: "~/projects",
      command: "git log --oneline",
      title: "projects",
      meta: [plural(projects.length, "project")],
    },
    {
      slug: "tags",
      cwd: "~/tags",
      command: "ls",
      title: "tags",
      meta: [plural(tags.size, "tag")],
    },
    {
      slug: "authors",
      cwd: "~",
      command: "who",
      title: "authors",
      meta: [plural(authors.length, "author")],
    },
    ...[...tags].map(([tag, tagged]) => ({
      slug: `tags/${tag}`,
      cwd: "~/blog",
      command: `grep -rl "#${tag}" .`,
      title: `#${tag}`,
      meta: [plural(tagged.length, "post")],
    })),
    ...authors.map((author) => ({
      slug: `authors/${author.id}`,
      cwd: "~",
      command: `finger ${author.id}`,
      title: author.data.name,
      meta: [author.data.bio ?? ""].filter(Boolean),
    })),
  ]

  for (const post of posts.flatMap((post) => [
    post,
    ...(series.get(post.id) ?? []),
  ])) {
    const words = (post.body ?? "").split(/\s+/).filter(Boolean).length
    cards.push({
      slug: `blog/${post.id}`,
      cwd: "~/blog",
      command: `less ${post.id}.md`,
      title: post.data.title,
      meta: [
        post.data.date.toISOString().slice(0, 10),
        `${Math.max(1, Math.round(words / 220))} min read`,
        ...(post.data.tags ?? []).slice(0, 3).map((tag) => `#${tag}`),
      ],
    })
  }
  return cards
}

// ---------------------------------------------------------------- render

const C = {
  crust: "#232634",
  mantle: "#292c3c",
  base: "#303446",
  surface1: "#51576d",
  text: "#c6d0f5",
  subtext: "#a5adce",
  overlay: "#838ba7",
  green: "#a6d189",
  blue: "#8caaee",
  mauve: "#ca9ee6",
  peach: "#ef9f76",
}

type Node = { type: string; props: Record<string, unknown> }
const h = (
  type: string,
  style: Record<string, unknown>,
  ...children: (Node | string)[]
): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children },
})

let fonts: { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]
async function loadFonts() {
  if (fonts) return fonts
  const require = createRequire(import.meta.url)
  const file = (weight: number) =>
    require.resolve(
      `@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-${weight}-normal.woff`,
    )
  fonts = [
    {
      name: "Plex Mono",
      data: await readFile(file(400)),
      weight: 400,
      style: "normal",
    },
    {
      name: "Plex Mono",
      data: await readFile(file(700)),
      weight: 700,
      style: "normal",
    },
  ]
  return fonts
}

export async function renderOgCard(card: OgCard, site: URL | undefined) {
  const host = site?.host ?? "localhost"
  const { user, host: hostname } = TERMINAL
  const size = card.title.length > 60 ? 54 : card.title.length > 32 ? 66 : 84
  const dot = (background: string) =>
    h("div", { width: 22, height: 22, borderRadius: 11, background })

  const tree = h(
    "div",
    {
      width: 1200,
      height: 630,
      padding: 44,
      background: C.crust,
      fontFamily: "Plex Mono",
    },
    h(
      "div",
      {
        flex: 1,
        flexDirection: "column",
        background: C.base,
        border: `2px solid ${C.surface1}`,
        borderRadius: 26,
        overflow: "hidden",
      },
      // title bar
      h(
        "div",
        {
          height: 66,
          alignItems: "center",
          padding: "0 26px",
          background: C.mantle,
          borderBottom: `2px solid ${C.surface1}`,
        },
        h(
          "div",
          { width: 260, gap: 12 },
          dot("#ff5f57"),
          dot("#febc2e"),
          dot("#28c840"),
        ),
        h(
          "div",
          { flex: 1, justifyContent: "center", fontSize: 24, color: C.overlay },
          `${user}@${hostname}: ${card.cwd}`,
        ),
        h(
          "div",
          {
            width: 260,
            justifyContent: "flex-end",
            fontSize: 24,
            color: C.overlay,
          },
          h("span", { color: C.mauve, fontWeight: 700 }, ">"),
          h("span", { color: C.green, fontWeight: 700, marginRight: 10 }, "_"),
          host,
        ),
      ),
      // body
      h(
        "div",
        { flex: 1, flexDirection: "column", padding: "46px 58px 40px" },
        h(
          "div",
          { fontSize: 30, color: C.text },
          h("span", { color: C.green }, `${user}@${hostname}`),
          h("span", { color: C.overlay }, ":"),
          h("span", { color: C.blue }, card.cwd),
          h("span", { color: C.overlay, marginRight: 14 }, "$"),
          card.command,
        ),
        h(
          "div",
          {
            flex: 1,
            flexWrap: "wrap",
            alignContent: "flex-end",
            alignItems: "flex-end",
            marginTop: 26,
            fontSize: size,
            fontWeight: 700,
            lineHeight: 1.12,
            color: C.text,
            letterSpacing: -1,
          },
          ...card.title
            .split(" ")
            .map((word) => h("div", { marginRight: size * 0.6 }, word)),
          h("div", {
            width: size * 0.5,
            height: size * 0.95,
            marginBottom: size * 0.08,
            marginLeft: -size * 0.45,
            background: C.mauve,
          }),
        ),
        h(
          "div",
          {
            marginTop: 28,
            fontSize: 28,
            color: C.subtext,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
          card.meta.join("  ·  "),
        ),
      ),
    ),
  )

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: await loadFonts(),
  })
  return new Resvg(svg).render().asPng()
}
