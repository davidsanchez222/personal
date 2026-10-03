// What David is up to right now. Shown by `now`, `np`, `reading` and `ate` in
// the terminal, and on the /now page.
//
// TODO(david): these are placeholder entries. Replace them with your own.

export type Track = {
  title: string;
  artist: string;
  album?: string;
  /** "m:ss", drives the progress bar. */
  duration?: string;
  url?: string;
  cover?: string;
};

export type Book = {
  title: string;
  author: string;
  status: "reading" | "finished" | "queued";
  /** 0–100, for books you're reading. */
  progress?: number;
  pages?: number;
  note?: string;
  url?: string;
};

export type Meal = {
  dish: string;
  place: string;
  city?: string;
  /** ISO date, optionally with a time: "2026-10-01T19:42". */
  date: string;
  /** 1–5 stars. */
  rating?: number;
  note?: string;
  url?: string;
};

export type Now = {
  updated: string;
  listening: { current: Track; recent: Track[] };
  reading: Book[];
  ate: Meal[];
  /**
   * Optional: live "now playing" from Last.fm (connect Spotify/Apple Music to
   * Last.fm to scrobble). Create a read-only API key at
   * https://www.last.fm/api/account/create. It's visible in the page source.
   */
  lastfm?: { user: string; apiKey: string };
};

export const NOW: Now = {
  updated: "2026-10-02",
  listening: {
    current: {
      title: "Weird Fishes/Arpeggi",
      artist: "Radiohead",
      album: "In Rainbows",
      duration: "5:18",
    },
    recent: [
      {
        title: "Midnight City",
        artist: "M83",
        album: "Hurry Up, We're Dreaming",
      },
      { title: "Let It Happen", artist: "Tame Impala", album: "Currents" },
      { title: "Nights", artist: "Frank Ocean", album: "Blonde" },
      { title: "Teardrop", artist: "Massive Attack", album: "Mezzanine" },
    ],
  },
  reading: [
    {
      title: "Inference Engineering",
      author: "",
      status: "reading",
      progress: 62,
      pages: 352,
      note: "currently on the chapter about tracer bullets",
    },
    {
      title: "The Linux Command Line",
      author: "William Shotts",
      status: "finished",
      pages: 504,
      note: "the reason this website exists",
    },
    {
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
      status: "queued",
      pages: 616,
    },
  ],
  ate: [
    {
      dish: "tacos al pastor",
      place: "the taco truck on 5th",
      date: "2026-10-01T19:42",
      rating: 5,
      note: "pineapple on top, as nature intended",
    },
    {
      dish: "tonkotsu ramen",
      place: "a tiny ramen counter",
      date: "2026-09-28T12:15",
      rating: 4,
      note: "broth: 10/10. wait: 45 minutes.",
    },
    {
      dish: "breakfast burrito",
      place: "my kitchen",
      date: "2026-09-27T09:03",
      rating: 3,
      note: "self-made. compiles, but with warnings.",
    },
  ],
};
