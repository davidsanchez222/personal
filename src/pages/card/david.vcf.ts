import type { APIRoute } from "astro"
import { getEntry } from "astro:content"
import { SITE, SOCIALS, TERMINAL } from "@/consts"

// vCard text values escape backslashes, commas, semicolons and newlines.
const escape = (value: string) =>
  value.replace(/[\\,;]/g, "\\$&").replace(/\n/g, "\\n")

export const GET: APIRoute = async ({ site }) => {
  const author = await getEntry("authors", TERMINAL.author)
  const [first, ...rest] = SITE.title.split(" ")
  const last = rest.join(" ")

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escape(SITE.title)}`,
    `N:${escape(last)};${escape(first)};;;`,
    author?.data.mail && `EMAIL;TYPE=INTERNET:${author.data.mail}`,
    site && `URL:${site.href}`,
    ...SOCIALS.filter(({ href }) => href.startsWith("https://")).map(
      ({ label, href }) => `URL;TYPE=${label}:${href}`,
    ),
    author?.data.bio && `NOTE:${escape(author.data.bio)}`,
    author?.data.avatar.startsWith("https://") &&
      `PHOTO;VALUE=URI:${author.data.avatar}`,
    "END:VCARD",
  ].filter(Boolean)

  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/vcard; charset=utf-8" },
  })
}
