import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  AttributeValues,
  FieldOption,
  FieldSnapshot,
  FieldType,
  FieldValidation,
  FieldValue,
  VisibilityCondition,
} from "@/lib/fields/types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("package"),
  /** Inactive categories are hidden from sellers, so admins can set them up before launch. */
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/** The reusable question bank. "RAM" is defined once and used by phones and laptops. */
export const fieldDefinitions = pgTable(
  "field_definitions",
  {
    id: serial("id").primaryKey(),
    /** Stable identifier listings store answers under. Immutable once created. */
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: text("type").$type<FieldType>().notNull(),
    helpText: text("help_text"),
    placeholder: text("placeholder"),
    unit: text("unit"),
    options: jsonb("options").$type<FieldOption[]>().notNull().default([]),
    validation: jsonb("validation").$type<FieldValidation>().notNull().default({}),
    defaultValue: jsonb("default_value").$type<FieldValue | null>(),
    /** Set instead of deleting when listings already hold answers for this field. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("field_definitions_key_idx").on(t.key)],
);

/** Which fields a category uses, in what order, and with what per-category rules. */
export const categoryFields = pgTable(
  "category_fields",
  {
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    fieldId: integer("field_id")
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    required: boolean("required").notNull().default(false),
    showOnCard: boolean("show_on_card").notNull().default(false),
    condition: jsonb("condition").$type<VisibilityCondition | null>(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.fieldId] }), index("category_fields_field_idx").on(t.fieldId)],
);

export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    // Common to every listing: real columns, so they can be sorted, filtered and indexed.
    title: text("title").notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull(),
    condition: text("condition").notNull(),
    location: text("location").notNull(),
    sellerName: text("seller_name").notNull(),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    // Category-specific answers, keyed by field key, plus the field definitions
    // as they were when the listing was published.
    attributes: jsonb("attributes").$type<AttributeValues>().notNull().default({}),
    fieldSnapshot: jsonb("field_snapshot").$type<FieldSnapshot[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    index("listings_category_created_idx").on(t.categoryId, t.createdAt),
    index("listings_created_idx").on(t.createdAt),
    // Lets future filters like attributes @> '{"storage":"256gb"}' use an index.
    index("listings_attributes_gin_idx").using("gin", t.attributes),
    check("listings_price_positive", sql`${t.price} > 0`),
  ],
);

export type Category = typeof categories.$inferSelect;
export type FieldDefinitionRow = typeof fieldDefinitions.$inferSelect;
export type CategoryFieldRow = typeof categoryFields.$inferSelect;
export type Listing = typeof listings.$inferSelect;
