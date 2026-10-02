import { SITE, SOCIALS, TERMINAL } from "@/consts"
import { getPosts, getSubposts, getTags } from "@/lib/content"
import type { TermData, TermPost } from "@/lib/terminal/types"
import { getCollection, getEntry, type CollectionEntry } from "astro:content"

const toPost = (
  entry: CollectionEntry<"blog">,
  subposts: CollectionEntry<"blog">[] = [],
): TermPost => {
  const body = entry.body ?? ""
  return {
    id: entry.id,
    slug: entry.id.split("/").pop() ?? entry.id,
    title: entry.data.title,
    description: entry.data.description,
    date: entry.data.date.toISOString(),
    tags: entry.data.tags ?? [],
    url: `/blog/${entry.id}`,
    bytes: new TextEncoder().encode(body).length,
    words: body.split(/\s+/).filter(Boolean).length,
    subposts: subposts.map((sub) => toPost(sub)),
  }
}

// Serializes the content collections for the homepage terminal, which turns
// them into a virtual filesystem on the client.
export async function getTerminalData(
  site: URL | undefined,
): Promise<TermData> {
  const [posts, series, tags, projects, author] = await Promise.all([
    getPosts(),
    getSubposts(),
    getTags(),
    getCollection("projects"),
    getEntry("authors", TERMINAL.author),
  ])

  return {
    site: {
      title: SITE.title,
      description: SITE.description,
      url: site?.href ?? "/",
    },
    prompt: { user: TERMINAL.user, host: TERMINAL.host },
    user: {
      name: author?.data.name ?? TERMINAL.user,
      pronouns: author?.data.pronouns,
      bio: author?.data.bio,
      avatar: author?.data.avatar ?? "",
      mail: author?.data.mail,
    },
    whoami: TERMINAL.whoami,
    posts: posts.map((post) => toPost(post, series.get(post.id))),
    projects: projects
      .sort(
        (a, b) =>
          (b.data.startDate?.getTime() ?? 0) -
          (a.data.startDate?.getTime() ?? 0),
      )
      .map((project) => ({
        slug: project.id,
        name: project.data.name,
        description: project.data.description,
        link: project.data.link,
        tags: project.data.tags ?? [],
        startDate: project.data.startDate?.toISOString(),
        endDate: project.data.endDate?.toISOString(),
      })),
    tags: [...tags].map(([name, tagged]) => ({
      name,
      posts: tagged.map((post) => post.id),
    })),
    socials: SOCIALS.map(({ label, href }) => ({ label, href })),
    builtAt: new Date().toISOString(),
  }
}
