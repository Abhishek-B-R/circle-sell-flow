import { readJson, route } from "@/server/http";
import { createListing, listListings } from "@/server/services/listings";

/** GET /api/listings?category=sofas&q=leather */
export const GET = route(({ db, req }) => {
  const p = new URL(req.url).searchParams;
  return listListings(db, { category: p.get("category") ?? undefined, q: p.get("q") ?? undefined });
});

/** POST /api/listings — validated against the category's current field config. */
export const POST = route(async ({ db, req }) => createListing(db, await readJson(req)));
