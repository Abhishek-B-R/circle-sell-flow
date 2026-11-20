import { asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { categories, categoryFields, fieldDefinitions, listings, type FieldDefinitionRow } from "../db/schema";
import { conflict, notFound, parseOrThrow } from "../errors";
import { fieldDefinitionInputSchema } from "@/lib/fields/definition-schema";
import type { FieldDefinition } from "@/lib/fields/types";
import { validateCategoryLayout } from "@/lib/fields/validate";
import { getCategoryFields } from "./categories";

export interface FieldWithUsage extends FieldDefinition {
  archived: boolean;
  categories: { id: number; name: string }[];
  listingCount: number;
}

export function toFieldDefinition(row: FieldDefinitionRow): FieldDefinition {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    helpText: row.helpText,
    placeholder: row.placeholder,
    unit: row.unit,
    options: row.options,
    validation: row.validation,
    defaultValue: row.defaultValue ?? null,
  };
}

/** How many listings hold an answer for each field key. One query for all fields. */
async function answerCounts(db: Db): Promise<Map<string, number>> {
  const rows = await db.execute<{ key: string; n: number }>(
    sql`select k as key, count(*)::int as n from ${listings}, jsonb_object_keys(${listings.attributes}) as k group by k`,
  );
  const list = (Array.isArray(rows) ? rows : (rows as { rows: { key: string; n: number }[] }).rows) as { key: string; n: number }[];
  return new Map(list.map((r) => [r.key, Number(r.n)]));
}

async function answerCount(db: Db, key: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(sql`${listings.attributes} ? ${key}`);
  return Number(row?.n ?? 0);
}

export async function listFields(db: Db, opts: { includeArchived?: boolean } = {}): Promise<FieldWithUsage[]> {
  const rows = await db
    .select()
    .from(fieldDefinitions)
    .where(opts.includeArchived ? undefined : isNull(fieldDefinitions.archivedAt))
    .orderBy(asc(fieldDefinitions.label));

  const links = await db
    .select({ fieldId: categoryFields.fieldId, id: categories.id, name: categories.name })
    .from(categoryFields)
    .innerJoin(categories, eq(categories.id, categoryFields.categoryId))
    .orderBy(asc(categories.name));

  const counts = await answerCounts(db);
  return rows.map((row) => ({
    ...toFieldDefinition(row),
    archived: row.archivedAt != null,
    categories: links.filter((l) => l.fieldId === row.id).map(({ id, name }) => ({ id, name })),
    listingCount: counts.get(row.key) ?? 0,
  }));
}

export async function getField(db: Db, id: number): Promise<FieldDefinition> {
  const [row] = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id));
  if (!row) throw notFound("Field");
  return toFieldDefinition(row);
}

export async function createField(db: Db, body: unknown): Promise<FieldDefinition> {
  const input = parseOrThrow(fieldDefinitionInputSchema, body);
  const [existing] = await db.select({ id: fieldDefinitions.id }).from(fieldDefinitions).where(eq(fieldDefinitions.key, input.key));
  if (existing) throw conflict(`A field with key "${input.key}" already exists. Reuse it, or pick another key.`);
  const [row] = await db.insert(fieldDefinitions).values(input).returning();
  return toFieldDefinition(row);
}

/**
 * Edits are safe by design: labels, help text, options and rules can change
 * freely because published listings keep their own snapshot. Two things are
 * guarded, because they would corrupt existing data or configuration:
 * - the key never changes (listings store answers under it)
 * - the type can't change once listings hold answers in the old shape
 */
export async function updateField(db: Db, id: number, body: unknown): Promise<FieldDefinition> {
  const current = await getField(db, id);
  const input = parseOrThrow(fieldDefinitionInputSchema, body);

  if (input.key !== current.key) throw conflict("A field's key can't change after it's created, because listings store answers under it.");
  if (input.type !== current.type) {
    const answers = await answerCount(db, current.key);
    if (answers > 0) {
      throw conflict(
        `${answers} listing${answers === 1 ? " has" : "s have"} answers for "${current.label}" as ${current.type}. Create a new field instead of changing its type.`,
      );
    }
  }

  // Removing an option that another field's visibility rule depends on would
  // silently break that rule, so re-check every category that uses this field.
  const usedIn = await db.select({ categoryId: categoryFields.categoryId }).from(categoryFields).where(eq(categoryFields.fieldId, id));
  for (const { categoryId } of usedIn) {
    const fields = (await getCategoryFields(db, categoryId)).map((f) => (f.id === id ? { ...f, ...input } : f));
    const problems = validateCategoryLayout(fields);
    if (problems.length) throw conflict(problems[0], { problems });
  }

  const [row] = await db.update(fieldDefinitions).set(input).where(eq(fieldDefinitions.id, id)).returning();
  return toFieldDefinition(row);
}

/**
 * Deleting keeps history intact: a field still used by categories must be
 * detached first; a field with answers on listings is archived (hidden from
 * the library) rather than removed.
 */
export async function deleteField(db: Db, id: number): Promise<{ result: "deleted" | "archived" }> {
  const field = await getField(db, id);
  const usedIn = await db
    .select({ name: categories.name })
    .from(categoryFields)
    .innerJoin(categories, eq(categories.id, categoryFields.categoryId))
    .where(eq(categoryFields.fieldId, id));
  if (usedIn.length) {
    throw conflict(`"${field.label}" is used by ${usedIn.map((c) => c.name).join(", ")}. Remove it from those categories first.`);
  }
  if ((await answerCount(db, field.key)) > 0) {
    await db.update(fieldDefinitions).set({ archivedAt: new Date() }).where(eq(fieldDefinitions.id, id));
    return { result: "archived" };
  }
  await db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, id));
  return { result: "deleted" };
}

export async function restoreField(db: Db, id: number) {
  await getField(db, id);
  await db.update(fieldDefinitions).set({ archivedAt: null }).where(eq(fieldDefinitions.id, id));
}
