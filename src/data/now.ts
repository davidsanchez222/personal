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
  /** 1–10 stars. */
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
      title: "Borderline - Radio Edit",
      artist: "Michael Gray",
      album: "Analog Is On",
      duration: "3:15",
    },
    recent: [
      { title: "Brain Fog", artist: "slayr", album: "Half Blood (BloodLuxe)" },
      { title: "Magic I Want U", artist: "Jane Remover", album: "Heart" },
      { title: "Trailblaze", artist: "Cowgirl Clue", album: "Rodeo Star" },
      {
        title: "Root of all Evil",
        artist: "Daniel Caesar",
        album: "Son Of Spergy",
      },
    ],
  },
  reading: [
    {
      title: "Inference Engineering",
      author: "",
      status: "reading",
      progress: 50,
      pages: 208,
      note: "currently on the chapter about tracer bullets",
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
      dish: "chicken waffle sandwhich",
      place: "chick fil a",
      date: "2026-10-02T19:42",
      rating: 10,
      note: "ts was heavenly",
    },
    {
      dish: "mac and cheese meal prep",
      place: "me",
      date: "2026-10-02T12:15",
      rating: 10,
      note: "60g of protein cracked",
    },
  ],
};
