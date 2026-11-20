import { idParam, readJson, route } from "@/server/http";
import { getCategoryFields, saveCategoryLayout } from "@/server/services/categories";

/** GET /api/categories/:id/fields — the seller form definition, in order. */
export const GET = route(({ db, params }) => getCategoryFields(db, idParam(params.id)));

/** PUT /api/categories/:id/fields — replace the whole arrangement atomically. */
export const PUT = route(async ({ db, req, params }) => saveCategoryLayout(db, idParam(params.id), await readJson(req)));
