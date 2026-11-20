import { readJson, route } from "@/server/http";
import { createField, listFields } from "@/server/services/fields";

/** GET /api/fields?archived=1 — the field library with usage counts. */
export const GET = route(({ db, req }) => listFields(db, { includeArchived: new URL(req.url).searchParams.has("archived") }));

export const POST = route(async ({ db, req }) => createField(db, await readJson(req)));
