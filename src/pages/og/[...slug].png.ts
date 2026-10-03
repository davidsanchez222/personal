import type { APIRoute, GetStaticPaths } from "astro"
import { getOgCards, type OgCard, renderOgCard } from "@/lib/og"

export const getStaticPaths = (async () =>
  (await getOgCards()).map((card) => ({
    params: { slug: card.slug },
    props: { card },
  }))) satisfies GetStaticPaths

export const GET: APIRoute<{ card: OgCard }> = async ({ props, site }) =>
  new Response(new Uint8Array(await renderOgCard(props.card, site)), {
    headers: { "Content-Type": "image/png" },
  })
