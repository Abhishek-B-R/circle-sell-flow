import { and, desc, eq, ilike, ne, type SQL } from "drizzle-orm";
import type { Db } from "../db/client";
import { categories, listings } from "../db/schema";
import { AppError, invalid, notFound, zodFieldErrors } from "../errors";
import { createListingSchema } from "@/lib/listing";
import { formatFieldValue } from "@/lib/fields/registry";
import type { FieldSnapshot } from "@/lib/fields/types";
import { snapshotFields, validateAttributes } from "@/lib/fields/validate";
import { getCategory, getCategoryFields } from "./categories";

export interface ListingCard {
  id: number;
  title: string;
  price: number;
  condition: string;
  location: string;
  image: string | null;
  createdAt: Date;
  category: { name: string; slug: string; icon: string };
  /** Formatted values of fields marked "show on card", e.g. ["128 GB", "8 GB"]. */
  highlights: string[];
}

export interface ListingSpec {
  key: string;
  label: string;
  value: string;
}

const cardColumns = {
  id: listings.id,
  title: listings.title,
  price: listings.price,
  condition: listings.condition,
  location: listings.location,
  images: listings.images,
  createdAt: listings.createdAt,
  attributes: listings.attributes,
  fieldSnapshot: listings.fieldSnapshot,
  category: { name: categories.name, slug: categories.slug, icon: categories.icon },
};

/** Turns stored answers into display rows, using the listing's own snapshot. */
export function describeAttributes(snapshot: FieldSnapshot[], attributes: Record<string, unknown>, onlyCard = false): ListingSpec[] {
  return snapshot
    .filter((f) => attributes[f.key] !== undefined && (!onlyCard || f.showOnCard))
    .map((f) => ({ key: f.key, label: f.label, value: formatFieldValue(attributes[f.key] as never, f) }));
}

function toCard(row: { images: string[]; attributes: Record<string, unknown>; fieldSnapshot: FieldSnapshot[] } & Omit<ListingCard, "image" | "highlights">): ListingCard {
  const { images, attributes, fieldSnapshot, ...rest } = row;
  return {
    ...rest,
    image: images[0] ?? null,
    highlights: describeAttributes(fieldSnapshot, attributes, true).map((s) => s.value),
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listListings(db: Db, opts: { category?: string; q?: string; limit?: number } = {}): Promise<ListingCard[]> {
  const filters: SQL[] = [];
  if (opts.category) filters.push(eq(categories.slug, opts.category));
  if (opts.q?.trim()) filters.push(ilike(listings.title, `%${escapeLike(opts.q.trim())}%`));

  const rows = await db
    .select(cardColumns)
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(listings.createdAt), desc(listings.id))
    .limit(Math.min(opts.limit ?? 60, 100));
  return rows.map(toCard);
}

export async function getListing(db: Db, id: number) {
  const [row] = await db
    .select({ listing: listings, category: categories })
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(eq(listings.id, id));
  if (!row) throw notFound("Listing");
  const { listing, category } = row;
  return {
    ...listing,
    category: { id: category.id, name: category.name, slug: category.slug, icon: category.icon },
    specs: describeAttributes(listing.fieldSnapshot, listing.attributes),
  };
}

export async function similarListings(db: Db, listingId: number, categoryId: number, limit = 4): Promise<ListingCard[]> {
  const rows = await db
    .select(cardColumns)
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(and(eq(listings.categoryId, categoryId), ne(listings.id, listingId)))
    .orderBy(desc(listings.createdAt))
    .limit(limit);
  return rows.map(toCard);
}

/**
 * The server is the source of truth: it re-loads the category's *current*
 * field config and re-validates everything the browser already checked.
 * Errors come back keyed by input path so the form can show them inline.
 */
export async function createListing(db: Db, body: unknown) {
  const parsed = createListingSchema.safeParse(body);
  const commonErrors = parsed.success ? {} : zodFieldErrors(parsed.error);

  const raw = (body ?? {}) as { categoryId?: unknown; attributes?: unknown };
  const categoryId = Number(raw.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) throw invalid({ ...commonErrors, categoryId: "Choose a category" });

  const category = await getCategory(db, categoryId).catch(() => {
    throw invalid({ ...commonErrors, categoryId: "This category no longer exists" });
  });
  if (!category.isActive) throw new AppError(`${category.name} isn't accepting new listings right now`, 422);

  const fields = await getCategoryFields(db, category.id);
  const attrInput = raw.attributes && typeof raw.attributes === "object" ? (raw.attributes as Record<string, unknown>) : {};
  const attrs = validateAttributes(fields, attrInput);

  const fieldErrors = { ...commonErrors };
  for (const [key, message] of Object.entries(attrs.errors)) fieldErrors[`attributes.${key}`] = message;
  if (!parsed.success || !attrs.ok) throw invalid(fieldErrors);

  const { attributes: _ignored, categoryId: _id, ...common } = parsed.data;
  const answered = fields.filter((f) => attrs.values[f.key] !== undefined);

  const [row] = await db
    .insert(listings)
    .values({ ...common, categoryId: category.id, attributes: attrs.values, fieldSnapshot: snapshotFields(answered) })
    .returning({ id: listings.id });
  return row;
}
