import { idParam, readJson, route } from "@/server/http";
import { deleteCategory, getCategory, getCategoryFields, updateCategory } from "@/server/services/categories";

/** GET /api/categories/:idOrSlug — category plus its resolved form fields. */
export const GET = route(async ({ db, params }) => {
  const category = await getCategory(db, params.id);
  return { ...category, fields: await getCategoryFields(db, category.id) };
});

export const PATCH = route(async ({ db, req, params }) => updateCategory(db, idParam(params.id), await readJson(req)));

export const DELETE = route(async ({ db, params }) => deleteCategory(db, idParam(params.id)));
