// Client-only: optional live Last.fm data and the player progress ticker.
import type { Now, Track } from "@/data/now"
import { ago, clock } from "@/lib/now/render"
import { storage } from "@/scripts/terminal/html"

export type Listening = {
  current: Track
  recent: Track[]
  label: string
  live: boolean
  paused: boolean
}

const CACHE_KEY = "dsh.lastfm"
const CACHE_MS = 60_000

type LastfmTrack = {
  name: string
  url?: string
  artist?: { "#text"?: string; name?: string }
  album?: { "#text"?: string }
  image?: { size: string; "#text": string }[]
  date?: { uts: string }
  "@attr"?: { nowplaying?: string }
}

const fromLastfm = (track: LastfmTrack): Track => ({
  title: track.name,
  artist: track.artist?.["#text"] ?? track.artist?.name ?? "unknown artist",
  album: track.album?.["#text"] || undefined,
  url: track.url,
  cover:
    track.image?.find((image) => image.size === "large")?.["#text"] ||
    undefined,
})

export const staticListening = (now: Now): Listening => ({
  ...now.listening,
  label: "on repeat lately",
  live: false,
  paused: false,
})

/** Live data from Last.fm when configured, otherwise the static file. */
export async function getListening(now: Now): Promise<Listening> {
  if (!now.lastfm) return staticListening(now)
  const cached = storage.get(sessionStorage, CACHE_KEY)
  if (cached) {
    const { at, value } = JSON.parse(cached)
    if (Date.now() - at < CACHE_MS) return value
  }
  try {
    const url = new URL("https://ws.audioscrobbler.com/2.0/")
    url.search = new URLSearchParams({
      method: "user.getrecenttracks",
      user: now.lastfm.user,
      api_key: now.lastfm.apiKey,
      format: "json",
      limit: "6",
    }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
    const tracks: LastfmTrack[] =
      (await response.json())?.recenttracks?.track ?? []
    const [first, ...rest] = tracks
    if (!first) return staticListening(now)
    const playing = first["@attr"]?.nowplaying === "true"
    const value: Listening = {
      current: fromLastfm(first),
      recent: rest.map(fromLastfm),
      live: playing,
      paused: !playing,
      label: playing
        ? "now playing"
        : `last played ${first.date ? ago(new Date(Number(first.date.uts) * 1000)) : ""}`,
    }
    storage.set(
      sessionStorage,
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), value }),
    )
    return value
  } catch {
    return staticListening(now)
  }
}

let ticking = false

/** Advances every player's progress bar once a second. */
export function startTicker() {
  if (ticking) return
  ticking = true
  const loaded = Date.now()
  setInterval(() => {
    for (const player of document.querySelectorAll<HTMLElement>(
      "t-player:not([data-paused])",
    )) {
      const duration = Number(player.dataset.duration) || 210
      const offset = Number(player.dataset.offset) || 0
      const elapsed = (offset + (Date.now() - loaded) / 1000) % duration
      const time = player.querySelector("[data-elapsed]")
      const fill = player.querySelector<HTMLElement>("t-fill")
      if (time) time.textContent = clock(elapsed)
      if (fill) fill.style.width = `${(elapsed / duration) * 100}%`
    }
  }, 1000)
}
