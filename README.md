# Circle: Sell Product flow

A simplified sell flow for a secondhand marketplace where **categories and their listing fields are data, not code**. Admins build each category's form from a shared field library; sellers get a form generated from that configuration; buyers see listings on a homepage and a product detail page.

**Demo:** _link added after deploy_

| Page | What it does |
| --- | --- |
| `/` | Listings as product cards, category chips, search |
| `/listings/:id` | Product detail page: gallery, price, condition, category details, description, seller, similar listings |
| `/sell` → `/sell/:category` | Pick a category, then one form: common info + that category's fields, live card preview, draft autosave |
| `/admin` | Create and manage categories (draft or open to sellers) |
| `/admin/categories/:id` | Form builder: add, order, require and condition fields, with a live seller preview |
| `/admin/fields` | Field library: create and edit reusable fields, see where each is used |

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. That's it: with no `DATABASE_URL`, the app runs an embedded Postgres ([PGlite](https://pglite.dev), Postgres compiled to WASM) stored in `./.data`, applies the migrations and loads the sample data on first boot.

To use a real Postgres instead (Neon, Supabase, local):

```bash
cp .env.example .env        # set DATABASE_URL
npm run setup               # migrate + seed if empty
npm run dev
```

Other scripts: `npm test` (unit + integration tests), `npm run lint` (type check), `npm run db:reset` (wipe and reseed; asks for `-- --yes` against a real `DATABASE_URL`).

**Sample data** (`src/server/db/seed.ts`): 22 fields, 4 categories (Mobile Phones, Laptops, Sofas, plus Bicycles left as a draft) and 9 listings. It's loaded through the same services the API uses, so every sample passes real validation.

## Architecture

```
src/
  lib/fields/        Field engine. Framework-free, runs in browser and server.
    types.ts           FieldDefinition, ResolvedField, VisibilityCondition, ...
    registry.ts        One entry per field type: settings, validation, formatting
    conditions.ts      Visibility rules ("show X when Y is Yes")
    validate.ts        validateAttributes(), validateCategoryLayout()
    definition-schema.ts  zod schemas for admin input
  lib/listing.ts     Common listing fields (title, price, condition, ...)
  server/
    db/              Drizzle schema, client (Postgres or PGlite), seed
    services/        Business logic: categories, fields, listings
    http.ts          Route wrapper: errors -> JSON with the right status
  app/api/           Thin REST handlers over the services
  components/
    fields/          FIELD_INPUTS (type -> input) and <DynamicFields>
    sell/            Seller form
    admin/           Category builder, field library, field editor
```

### Data model

```
categories            field_definitions              listings
──────────            ─────────────────              ────────
id                    id                              id
slug, name, icon      key  (immutable)                category_id ─► categories
description           label, type                     title, description, price,
is_active             help_text, placeholder, unit    condition, location,
                      options      jsonb              seller_name, images jsonb
        ▲             validation   jsonb              attributes     jsonb  {key: value}
        │             default_value jsonb             field_snapshot jsonb
        │             archived_at
        │                    ▲
        └── category_fields ─┘
            position, required, show_on_card, condition jsonb
```

**What's common vs what varies.** Everything every listing has (title, description, price, condition, location, seller, photos) is a real column: it's sorted, filtered and shown on every card, and the database enforces it (e.g. `price > 0`). Everything category-specific lives in `attributes`, a JSONB map keyed by field key, with a GIN index so filters like `attributes @> '{"storage":"256gb"}'` stay fast.

**Fields are a reusable library, attached to categories.** "RAM", "Storage" and "Battery health" are defined once and shared by phones and laptops. `category_fields` holds what's per-category: order, required, whether the value shows on product cards, and the visibility rule. So the same field can be required for phones and optional for laptops.

**Listings keep a snapshot of the fields they were created with.** Admins can rename a field, remove an option or take a field out of a category, and older listings still render exactly what the seller saw. The PDP and cards render from `field_snapshot`, never from the live config.

### How the seller flow consumes the configuration

1. `GET /api/categories/:slug` (or the server component) returns the category's **resolved fields**: definitions merged with per-category settings, in order.
2. `<DynamicFields>` renders them. For each field it looks up the input in `FIELD_INPUTS[type]` and shows it if `visibleFieldKeys()` says its rule matches. There is no per-category form anywhere.
3. On submit the browser runs `validateAttributes()` for instant feedback; `POST /api/listings` re-loads the category's *current* config and runs the **same function** on the server. Errors come back keyed by path (`price`, `attributes.battery_health`) and appear inline.

### Adding things later

| Change | Effort |
| --- | --- |
| New category | Admin UI: create it, pick fields, save. No code, no deploy. |
| New field (e.g. "Screen size") | Admin UI. Reusable across categories immediately. |
| New conditional rule | Admin UI, in the builder. |
| New field **type** (e.g. "colour swatch") | One entry in `FIELD_TYPE_REGISTRY` (validation + formatting) and one component in `FIELD_INPUTS`. Both are `Record<FieldType, …>`, so TypeScript fails the build until both exist. |

## Field types and validation

Text, long text, number, dropdown, single choice (radio pills), multiple choice, yes/no toggle, date, and **dimensions** (L × W × H with a unit, for furniture).

Validation is configured per field and only offers what applies to its type: required (per category), min/max length, min/max value, whole numbers only, min/max picks, earliest/latest date (a fixed date or "always today"), default value and placeholder. The admin's default-value control is the real seller input for that field, so it can't hold a value the seller form would reject.

**Conditional fields.** Any field can be shown only when an earlier field `is`, `is not`, `is any of`, `is filled in` or `is empty`. The seed has *Warranty expiry date* (shown when *Under warranty* is Yes) and *Graphics card* (shown when *Dedicated graphics card* is Yes). Hidden fields are not required and their stale answers are dropped on submit. Chains collapse correctly (if A hides B, anything depending on B hides too).

## Decisions and trade-offs

- **JSONB attributes over EAV (a row per answer).** One read per listing, typed values (numbers, arrays, objects) stay intact, and a GIN index covers attribute filters. EAV would make per-attribute range queries easier (e.g. "RAM ≥ 8 GB" across millions of rows); if search needs that, a denormalised search index (Postgres generated columns or a search engine) is the next step, fed from the same JSON.
- **Saving a category layout is one atomic `PUT`.** The builder edits a draft locally (reorder, attach, rules) and saves the whole arrangement in a transaction, validated as a unit. Sellers never see a half-configured form, and rules like "a condition must point at an earlier field" can be checked across the whole list.
- **Rules may only depend on earlier fields.** Reads naturally top to bottom and makes cycles impossible by construction.
- **Guard rails on edits that would corrupt data:** a field's key never changes; its type can't change once listings hold answers (create a new field instead); removing an option that a visibility rule depends on is blocked with the reason; deleting a field in use by a category is blocked, and a field that listings have answered is archived instead of deleted. A category with listings can't be deleted, only deactivated.
- **Draft categories.** A category can be configured while hidden from sellers, then opened.
- **Server is the source of truth.** If an admin changes a category while a seller is mid-form, the server validates against the new config and the seller sees exactly which field needs attention.
- **Embedded Postgres for development.** Same SQL, same migrations as production Postgres, zero setup for reviewers.

### Seller experience details

Live card preview while typing; a "required details" progress bar that counts only fields currently visible; errors appear on blur and on submit, focus jumps to the first problem; radio and multi-choice as tap-friendly pills; units shown inside inputs; character counters on long text; drafts autosaved per category in the browser; a confirmation banner after publishing.

### Not built (deliberately, for scope)

- Authentication and roles (admin pages are open in the demo).
- Photo uploads: sellers paste image links. Uploads would go to object storage (S3/R2) and store URLs in the same `images` column.
- Per-category option subsets (e.g. phones offering only some storage sizes of the shared field), field groups/sections, and attribute filters on the homepage. The schema supports all three without migration of existing listings.
- Editing or deleting listings, pagination.

## API

All JSON. Errors return `{ error, fieldErrors?, problems? }` with 400/404/409/422.

| Method | Path | |
| --- | --- | --- |
| GET | `/api/categories?all=1` | Categories with field and listing counts (`all` includes drafts) |
| POST | `/api/categories` | Create |
| GET | `/api/categories/:idOrSlug` | Category + resolved fields (what the seller form renders) |
| PATCH / DELETE | `/api/categories/:id` | Update / delete (blocked if it has listings) |
| GET / PUT | `/api/categories/:id/fields` | Read / replace the field arrangement atomically |
| GET / POST | `/api/fields` | Library with usage (`?archived=1`) / create |
| GET / PATCH / DELETE | `/api/fields/:id` | Read / update (`{ "restore": true }` un-archives) / delete-or-archive |
| GET / POST | `/api/listings?category=&q=` | List / create (validated against current config) |
| GET | `/api/listings/:id` | One listing with formatted specs |

## Tests

`npm test` runs 24 tests: the field engine (conditions, per-type validation, layout rules, formatting) and service-level integration tests against an in-memory Postgres with the real migrations and seed, including "a new field and category work end to end without code changes" and "old listings stay readable after a field is renamed and an option removed".

## Stack

Next.js 16 (App Router, route handlers), React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, Postgres (Neon in the demo, PGlite locally), zod, Vitest.
