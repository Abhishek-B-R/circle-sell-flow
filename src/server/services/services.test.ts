import { beforeAll, describe, expect, it } from "vitest";
import { createDb, migrate, seedIfEmpty, type Db } from "../db/client";
import { AppError } from "../errors";
import { getCategory, getCategoryFields, saveCategoryLayout } from "./categories";
import { createField, deleteField, listFields, updateField } from "./fields";
import { createListing, getListing, listListings } from "./listings";

// A throwaway in-memory Postgres per test file, with the real migrations and seed.
let db: Db;
beforeAll(async () => {
  db = await createDb({ dataDir: "memory://" });
  await migrate(db, false);
  await seedIfEmpty(db);
}, 60_000);

const catchErr = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error("expected an error");
};

const validPhone = async () => {
  const phones = await getCategory(db, "mobile-phones");
  return {
    categoryId: phones.id,
    title: "Pixel 8, 128 GB, mint",
    description: "Barely used, always in a case, no scratches at all.",
    price: 30000,
    condition: "like_new",
    location: "Bengaluru",
    sellerName: "Test",
    attributes: { brand: "Google", model: "Pixel 8", storage: "128gb", ram: "8gb", battery_health: 95, under_warranty: "yes", warranty_expiry: "2099-01-01" },
  };
};

describe("seed", () => {
  it("loads categories, fields and listings through the real validation", async () => {
    expect((await listListings(db)).length).toBeGreaterThanOrEqual(9);
    expect((await getCategoryFields(db, (await getCategory(db, "sofas")).id)).map((f) => f.key)).toContain("dimensions");
  });
});

describe("listings", () => {
  it("creates a listing and freezes the field definitions with it", async () => {
    const { id } = await createListing(db, await validPhone());
    const listing = await getListing(db, id);
    expect(listing.specs.find((s) => s.key === "storage")?.value).toBe("128 GB");
    expect(listing.fieldSnapshot.map((f) => f.key)).toContain("warranty_expiry");
  });

  it("returns errors keyed by input path", async () => {
    const body = await validPhone();
    const err = await catchErr(createListing(db, { ...body, price: -5, attributes: { ...body.attributes, warranty_expiry: undefined, battery_health: 140 } }));
    expect(err.status).toBe(422);
    expect(Object.keys((err.details as { fieldErrors: object }).fieldErrors).sort()).toEqual([
      "attributes.battery_health",
      "attributes.warranty_expiry",
      "price",
    ]);
  });

  it("refuses listings in an inactive category", async () => {
    const bikes = await getCategory(db, "bicycles");
    const err = await catchErr(createListing(db, { ...(await validPhone()), categoryId: bikes.id }));
    expect(err.message).toMatch(/isn't accepting/);
  });

  it("filters by category and search text", async () => {
    const sofas = await listListings(db, { category: "sofas" });
    expect(sofas.every((l) => l.category.slug === "sofas")).toBe(true);
    expect((await listListings(db, { q: "macbook" }))[0].title).toMatch(/MacBook/);
    expect(await listListings(db, { q: "%" })).toEqual([]);
  });
});

describe("evolving the schema", () => {
  it("a new field + category works end to end without code changes", async () => {
    const lens = await createField(db, {
      key: "lens_mount",
      label: "Lens mount",
      type: "select",
      options: [{ value: "ef", label: "Canon EF" }, { value: "e", label: "Sony E" }],
    });
    const bikes = await getCategory(db, "bicycles");
    const before = await getCategoryFields(db, bikes.id);
    await saveCategoryLayout(db, bikes.id, {
      fields: [...before.map((f) => ({ fieldId: f.id, required: f.required })), { fieldId: lens.id, required: true }],
    });
    expect((await getCategoryFields(db, bikes.id)).at(-1)?.key).toBe("lens_mount");
  });

  it("keeps old listings readable after a field is renamed and an option removed", async () => {
    const { id } = await createListing(db, await validPhone());
    const ram = (await listFields(db)).find((f) => f.key === "ram")!;
    await updateField(db, ram.id, { ...ram, label: "Memory", options: ram.options.filter((o) => o.value !== "8gb") });
    const listing = await getListing(db, id);
    expect(listing.specs.find((s) => s.key === "ram")).toEqual({ key: "ram", label: "RAM", value: "8 GB" });
  });

  it("blocks a type change once listings hold answers", async () => {
    const battery = (await listFields(db)).find((f) => f.key === "battery_health")!;
    const err = await catchErr(updateField(db, battery.id, { ...battery, type: "text" }));
    expect(err.status).toBe(409);
  });

  it("blocks removing an option that a visibility rule depends on", async () => {
    const warranty = (await listFields(db)).find((f) => f.key === "under_warranty")!;
    const err = await catchErr(updateField(db, warranty.id, { ...warranty, options: [{ value: "no", label: "No" }, { value: "na", label: "N/A" }] }));
    expect(err.message).toMatch(/no longer exists/);
  });

  it("archives instead of deleting a field that listings have answered", async () => {
    const issues = (await listFields(db)).find((f) => f.key === "known_issues")!;
    expect((await catchErr(deleteField(db, issues.id))).message).toMatch(/Remove it from those categories first/);

    const scratch = await createField(db, { key: "scratch", label: "Scratch", type: "text" });
    expect(await deleteField(db, scratch.id)).toEqual({ result: "deleted" });
  });
});
