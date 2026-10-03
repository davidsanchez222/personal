import type { SvgComponent } from "astro/types";
import Email from "@/assets/icons/email.svg";
import GitHub from "@/assets/icons/github.svg";
import RSS from "@/assets/icons/rss.svg";
import Twitter from "@/assets/icons/twitter.svg";

export const SITE = {
  title: "David Sanchez",
  description:
    "David Sanchez's home directory on the internet: a terminal-flavored portfolio and blog.",
  locale: "en-US",
  dir: "ltr",
} as const;

export const NAVIGATION = [
  { href: "/blog", label: "blog/" },
  { href: "/now", label: "now/" },
  { href: "/projects", label: "projects/" },
  { href: "/authors", label: "authors/" },
];

export const SOCIALS: { href: string; label: string; icon: SvgComponent }[] = [
  { href: "https://github.com/davidsanchez222", label: "GitHub", icon: GitHub },
  { href: "https://twitter.com/dsanch100", label: "Twitter", icon: Twitter },
  { href: "mailto:davidsanchy22@gmail.com", label: "Email", icon: Email },
  { href: "/rss.xml", label: "RSS", icon: RSS },
];

// The homepage terminal (dsh). Text wrapped in `backticks` becomes a
// clickable command in the terminal output.
export const TERMINAL = {
  author: "david",
  user: "david",
  host: "portfolio",
  whoami: [
    "Hi, I'm David Sanchez, recent CS grad @ UGA and aspiring inference engineer",
    "I love keyboards and doing everything in my terminal so i wanted my website to be mostly a terminal (except the blog)",
    "This page is my home directory. Poke around with `ls`, `cd blog` or `cat about.txt`.",
    "I write about the things I build and tinker with. Run `man david` to read my blog.",
  ],
};
