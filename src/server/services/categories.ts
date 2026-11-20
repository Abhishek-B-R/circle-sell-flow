import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { categories, categoryFields, fieldDefinitions, listings, type Category } from "../db/schema";
import { AppError, conflict, notFound, parseOrThrow } from "../errors";
import { categoryInputSchema, categoryLayoutInputSchema } from "@/lib/fields/definition-schema";
import type { ResolvedField } from "@/lib/fields/types";
import { validateCategoryLayout } from "@/lib/fields/validate";
import { toFieldDefinition } from "./fields";

export interface CategorySummary extends Category {
  fieldCount: number;
  listingCount: number;
}

export async function listCategories(db: Db, opts: { includeInactive?: boolean } = {}): Promise<CategorySummary[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(opts.includeInactive ? undefined : eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const fieldCounts = await db.select({ id: categoryFields.categoryId, n: count() }).from(categoryFields).groupBy(categoryFields.categoryId);
  const listingCounts = await db.select({ id: listings.categoryId, n: count() }).from(listings).groupBy(listings.categoryId);
  const lookup = (xs: { id: number; n: number }[], id: number) => Number(xs.find((x) => x.id === id)?.n ?? 0);

  return rows.map((c) => ({ ...c, fieldCount: lookup(fieldCounts, c.id), listingCount: lookup(listingCounts, c.id) }));
}

/** Accepts a numeric id or a slug, so URLs can use either. */
export async function getCategory(db: Db, idOrSlug: number | string): Promise<Category> {
  const where = typeof idOrSlug === "number" || /^\d+$/.test(idOrSlug) ? eq(categories.id, Number(idOrSlug)) : eq(categories.slug, idOrSlug);
  const [row] = await db.select().from(categories).where(where);
  if (!row) throw notFound("Category");
  return row;
}

/** The category's form definition: field definitions merged with per-category settings, in order. */
export async function getCategoryFields(db: Db, categoryId: number): Promise<ResolvedField[]> {
  const rows = await db
    .select({ link: categoryFields, field: fieldDefinitions })
    .from(categoryFields)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, categoryFields.fieldId))
    .where(eq(categoryFields.categoryId, categoryId))
    .orderBy(asc(categoryFields.position));

  return rows.map(({ link, field }) => ({
    ...toFieldDefinition(field),
    required: link.required,
    showOnCard: link.showOnCard,
    condition: link.condition ?? null,
  }));
}

async function assertSlugFree(db: Db, slug: string, exceptId?: number) {
  const [taken] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(exceptId ? and(eq(categories.slug, slug), ne(categories.id, exceptId)) : eq(categories.slug, slug));
  if (taken) throw new AppError(`Slug "${slug}" is already used by another category`, 422, { fieldErrors: { slug: "Already in use" } });
}

export async function createCategory(db: Db, body: unknown): Promise<Category> {
  const input = parseOrThrow(categoryInputSchema, body);
  await assertSlugFree(db, input.slug);
  const [{ max }] = await db.select({ max: count() }).from(categories);
  const [row] = await db
    .insert(categories)
    .values({ ...input, sortOrder: Number(max) })
    .returning();
  return row;
}

export async function updateCategory(db: Db, id: number, body: unknown): Promise<Category> {
  await getCategory(db, id);
  const input = parseOrThrow(categoryInputSchema, body);
  await assertSlugFree(db, input.slug, id);
  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning();
  return row;
}

export async function deleteCategory(db: Db, id: number) {
  const category = await getCategory(db, id);
  const [{ n }] = await db.select({ n: count() }).from(listings).where(eq(listings.categoryId, id));
  if (n > 0) {
    throw conflict(`"${category.name}" has ${n} listing${n === 1 ? "" : "s"}. Deactivate it instead to hide it from sellers.`);
  }
  await db.delete(categories).where(eq(categories.id, id));
}

/**
 * Replaces a category's whole field arrangement in one transaction.
 * The admin builder edits a draft locally and saves it here, so ordering,
 * attaching, detaching and visibility rules are validated together and the
 * seller form never sees a half-saved state.
 */
export async function saveCategoryLayout(db: Db, categoryId: number, body: unknown): Promise<ResolvedField[]> {
  await getCategory(db, categoryId);
  const input = parseOrThrow(categoryLayoutInputSchema, body);

  const ids = input.fields.map((f) => f.fieldId);
  const defs = ids.length ? await db.select().from(fieldDefinitions).where(inArray(fieldDefinitions.id, ids)) : [];
  const byId = new Map(defs.map((d) => [d.id, d]));
  const current = new Set((await getCategoryFields(db, categoryId)).map((f) => f.id));

  const resolved: ResolvedField[] = input.fields.map((cfg) => {
    const def = byId.get(cfg.fieldId);
    if (!def) throw new AppError(`Field #${cfg.fieldId} doesn't exist`, 422);
    if (def.archivedAt && !current.has(def.id)) throw new AppError(`"${def.label}" is archived and can't be added`, 422);
    return { ...toFieldDefinition(def), required: cfg.required, showOnCard: cfg.showOnCard, condition: cfg.condition };
  });

  const problems = validateCategoryLayout(resolved);
  if (problems.length) throw new AppError(problems[0], 422, { problems });

  await db.transaction(async (tx) => {
    await tx.delete(categoryFields).where(eq(categoryFields.categoryId, categoryId));
    if (input.fields.length) {
      await tx.insert(categoryFields).values(input.fields.map((f, position) => ({ ...f, categoryId, position })));
    }
    await tx.update(categories).set({ updatedAt: new Date() }).where(eq(categories.id, categoryId));
  });

  return resolved;
}
