import { idParam, readJson, route } from "@/server/http";
import { deleteField, getField, restoreField, updateField } from "@/server/services/fields";

export const GET = route(({ db, params }) => getField(db, idParam(params.id)));

/** PATCH accepts a full definition, or `{ "restore": true }` to un-archive. */
export const PATCH = route(async ({ db, req, params }) => {
  const body = await readJson(req);
  if (body && typeof body === "object" && (body as { restore?: unknown }).restore === true) return restoreField(db, idParam(params.id));
  return updateField(db, idParam(params.id), body);
});

/** DELETE removes an unused field, or archives one that listings have answered. */
export const DELETE = route(({ db, params }) => deleteField(db, idParam(params.id)));
