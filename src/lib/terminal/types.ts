export type TermPost = {
  id: string
  slug: string
  title: string
  description: string
  date: string
  tags: string[]
  url: string
  bytes: number
  words: number
  subposts: TermPost[]
}

export type TermProject = {
  slug: string
  name: string
  description: string
  link: string
  tags: string[]
  startDate?: string
  endDate?: string
}

export type TermData = {
  site: { title: string; description: string; url: string }
  prompt: { user: string; host: string }
  user: {
    name: string
    pronouns?: string
    bio?: string
    avatar: string
    mail?: string
  }
  whoami: string[]
  posts: TermPost[]
  projects: TermProject[]
  tags: { name: string; posts: string[] }[]
  socials: { label: string; href: string }[]
  builtAt: string
}
