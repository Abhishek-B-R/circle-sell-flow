import { readJson, route } from "@/server/http";
import { createCategory, listCategories } from "@/server/services/categories";

/** GET /api/categories?all=1 — active categories (all, including drafts, with ?all=1). */
export const GET = route(({ db, req }) => listCategories(db, { includeInactive: new URL(req.url).searchParams.has("all") }));

/** POST /api/categories — create a category. */
export const POST = route(async ({ db, req }) => createCategory(db, await readJson(req)));
