import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { listings } from "./schema";
import { createCategory, saveCategoryLayout } from "../services/categories";
import { createField } from "../services/fields";
import { createListing } from "../services/listings";

/**
 * Sample data, loaded through the same services the API uses, so every
 * field, layout and listing below passes the real validation.
 */

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const gb = (...sizes: number[]) => sizes.map((n) => ({ value: n >= 1024 ? `${n / 1024}tb` : `${n}gb`, label: n >= 1024 ? `${n / 1024} TB` : `${n} GB` }));

const FIELDS = [
  { key: "brand", label: "Brand", type: "text", placeholder: "e.g. Apple, Samsung, Dell", validation: { minLength: 2, maxLength: 40 } },
  { key: "model", label: "Model", type: "text", placeholder: "e.g. iPhone 13, XPS 13", validation: { minLength: 2, maxLength: 60 } },
  { key: "storage", label: "Storage", type: "select", placeholder: "Select storage", options: gb(32, 64, 128, 256, 512, 1024, 2048) },
  { key: "ram", label: "RAM", type: "select", placeholder: "Select RAM", options: gb(2, 3, 4, 6, 8, 12, 16, 32, 64) },
  { key: "original_box", label: "Original box included", type: "checkbox", helpText: "Buyers trust phones that come with the box." },
  {
    key: "battery_health",
    label: "Battery health",
    type: "number",
    unit: "%",
    placeholder: "e.g. 89",
    helpText: "On iPhone: Settings → Battery → Battery Health.",
    validation: { min: 1, max: 100, integer: true },
  },
  { key: "accessories", label: "Accessories included", type: "multiselect", options: [
      { value: "charger", label: "Charger" },
      { value: "cable", label: "Cable" },
      { value: "case", label: "Case / cover" },
      { value: "earphones", label: "Earphones" },
      { value: "screen_guard", label: "Screen guard" },
      { value: "bill", label: "Original bill" },
    ] },
  { key: "processor", label: "Processor", type: "text", placeholder: "e.g. Apple M2, Intel Core i5-1235U", validation: { minLength: 2, maxLength: 60 } },
  { key: "has_dedicated_gpu", label: "Dedicated graphics card", type: "radio", options: yesNo, defaultValue: "no" },
  { key: "graphics_card", label: "Graphics card", type: "text", placeholder: "e.g. NVIDIA RTX 3060 6GB", validation: { minLength: 2, maxLength: 60 } },
  { key: "screen_size", label: "Screen size", type: "number", unit: "in", placeholder: "e.g. 14", validation: { min: 7, max: 21 } },
  { key: "purchase_date", label: "Purchase date", type: "date", helpText: "Roughly is fine. Check your bill if you have it.", validation: { minDate: "2010-01-01", maxDate: "today" } },
  { key: "under_warranty", label: "Under warranty", type: "radio", options: yesNo, defaultValue: "no" },
  { key: "warranty_expiry", label: "Warranty expiry date", type: "date", validation: { minDate: "today" } },
  { key: "color", label: "Colour", type: "text", placeholder: "e.g. Midnight blue", validation: { maxLength: 30 } },
  { key: "material", label: "Material", type: "select", placeholder: "Select material", options: [
      { value: "fabric", label: "Fabric" },
      { value: "leather", label: "Leather" },
      { value: "leatherette", label: "Leatherette" },
      { value: "velvet", label: "Velvet" },
      { value: "wood", label: "Solid wood" },
      { value: "other", label: "Other" },
    ] },
  { key: "seating_capacity", label: "Seating capacity", type: "number", unit: "seats", placeholder: "e.g. 3", validation: { min: 1, max: 12, integer: true } },
  { key: "pet_friendly", label: "Pet friendly", type: "radio", helpText: "Scratch-resistant fabric, or used in a home with pets.", options: yesNo },
  { key: "dimensions", label: "Dimensions", type: "dimensions", unit: "cm", helpText: "Length × width × height, measured at the widest points.", validation: { min: 10, max: 500 } },
  { key: "known_issues", label: "Known issues", type: "textarea", placeholder: "Scratches, dents, anything a buyer should know", validation: { maxLength: 500 } },
  { key: "frame_size", label: "Frame size", type: "select", options: [
      { value: "s", label: "Small" },
      { value: "m", label: "Medium" },
      { value: "l", label: "Large" },
    ] },
  { key: "gears", label: "Number of gears", type: "number", validation: { min: 1, max: 30, integer: true } },
] as const;

const warrantyRule = { fieldKey: "under_warranty", operator: "equals", value: "yes" } as const;

type LayoutEntry = [key: string, opts?: { required?: boolean; showOnCard?: boolean; condition?: { fieldKey: string; operator: string; value?: string } }];

const CATEGORIES: { name: string; slug: string; icon: string; description: string; isActive?: boolean; layout: LayoutEntry[] }[] = [
  {
    name: "Mobile Phones",
    slug: "mobile-phones",
    icon: "smartphone",
    description: "Smartphones of every brand",
    layout: [
      ["brand", { required: true }],
      ["model", { required: true, showOnCard: true }],
      ["storage", { required: true, showOnCard: true }],
      ["ram", { required: true, showOnCard: true }],
      ["battery_health", { required: true }],
      ["color"],
      ["original_box"],
      ["accessories"],
      ["purchase_date"],
      ["under_warranty", { required: true }],
      ["warranty_expiry", { required: true, condition: warrantyRule }],
      ["known_issues"],
    ],
  },
  {
    name: "Laptops",
    slug: "laptops",
    icon: "laptop",
    description: "Notebooks, ultrabooks and gaming laptops",
    layout: [
      ["brand", { required: true }],
      ["model", { required: true }],
      ["processor", { required: true, showOnCard: true }],
      ["ram", { required: true, showOnCard: true }],
      ["storage", { required: true, showOnCard: true }],
      ["has_dedicated_gpu", { required: true }],
      ["graphics_card", { required: true, condition: { fieldKey: "has_dedicated_gpu", operator: "equals", value: "yes" } }],
      ["screen_size"],
      ["battery_health"],
      ["purchase_date"],
      ["under_warranty", { required: true }],
      ["warranty_expiry", { required: true, condition: warrantyRule }],
      ["known_issues"],
    ],
  },
  {
    name: "Sofas",
    slug: "sofas",
    icon: "sofa",
    description: "Sofas, sectionals and recliners",
    layout: [
      ["material", { required: true, showOnCard: true }],
      ["seating_capacity", { required: true, showOnCard: true }],
      ["pet_friendly", { required: true }],
      ["dimensions", { required: true }],
      ["color"],
      ["known_issues"],
    ],
  },
  {
    name: "Bicycles",
    slug: "bicycles",
    icon: "bike",
    description: "Draft category: set up but not yet open to sellers",
    isActive: false,
    layout: [["brand", { required: true }], ["frame_size", { required: true, showOnCard: true }], ["gears", { showOnCard: true }]],
  },
];

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const LISTINGS: { category: string; daysAgo: number; data: Record<string, unknown> }[] = [
  {
    category: "mobile-phones",
    daysAgo: 0.1,
    data: {
      title: "iPhone 13, 128 GB, Midnight, excellent condition",
      description: "Used for two years with a case and screen guard from day one. No scratches on the screen, tiny mark on the frame. Face ID and all cameras work perfectly.",
      price: 38500,
      condition: "good",
      location: "Indiranagar, Bengaluru",
      sellerName: "Rohan M.",
      images: [img("1592750475338-74b7b21085ab"), img("1511707171634-5f897ff02aa9")],
      attributes: { brand: "Apple", model: "iPhone 13", storage: "128gb", ram: "4gb", battery_health: 86, color: "Midnight", original_box: true, accessories: ["cable", "case", "bill"], purchase_date: "2023-09-28", under_warranty: "no" },
    },
  },
  {
    category: "laptops",
    daysAgo: 0.4,
    data: {
      title: "MacBook Air M2 13\", 8/256, barely used",
      description: "Bought for college, mostly used for notes and browsing. 41 battery cycles. Comes with the original charger and box. AppleCare valid till next year.",
      price: 72000,
      condition: "like_new",
      location: "Koramangala, Bengaluru",
      sellerName: "Ananya S.",
      images: [img("1517336714731-489689fd1ca8"), img("1496181133206-80ce9b88a853")],
      attributes: { brand: "Apple", model: "MacBook Air M2", processor: "Apple M2", ram: "8gb", storage: "256gb", has_dedicated_gpu: "no", screen_size: 13.6, battery_health: 98, purchase_date: "2025-01-15", under_warranty: "yes", warranty_expiry: "2027-01-14" },
    },
  },
  {
    category: "sofas",
    daysAgo: 1,
    data: {
      title: "3-seater grey fabric sofa with cushions",
      description: "Sturdy wooden frame, high-density foam. Moving cities so selling. Pickup only from HSR Layout; I can help load it.",
      price: 14000,
      condition: "good",
      location: "HSR Layout, Bengaluru",
      sellerName: "Karthik R.",
      images: [img("1555041469-a586c61ea9bc"), img("1493663284031-b7e3aefcae8e")],
      attributes: { material: "fabric", seating_capacity: 3, pet_friendly: "yes", dimensions: { length: 210, width: 90, height: 85 }, color: "Ash grey" },
    },
  },
  {
    category: "mobile-phones",
    daysAgo: 2,
    data: {
      title: "Samsung Galaxy S23, 8/256, Phantom Black, under warranty",
      description: "Six months old, always in a case. Selling because I switched to an iPhone. Warranty card and bill included.",
      price: 46000,
      condition: "like_new",
      location: "Powai, Mumbai",
      sellerName: "Priya K.",
      images: [img("1610945265064-0e34e5519bbf"), img("1598327105666-5b89351aff97")],
      attributes: { brand: "Samsung", model: "Galaxy S23", storage: "256gb", ram: "8gb", battery_health: 97, color: "Phantom Black", original_box: true, accessories: ["charger", "cable", "bill"], purchase_date: "2026-05-10", under_warranty: "yes", warranty_expiry: "2027-05-09" },
    },
  },
  {
    category: "laptops",
    daysAgo: 3,
    data: {
      title: "ASUS ROG Strix G15 gaming laptop, RTX 3060",
      description: "Runs every modern game at high settings. Repasted six months ago, temps are great. Small scuff on the lid, otherwise mint.",
      price: 68000,
      condition: "good",
      location: "Andheri West, Mumbai",
      sellerName: "Vikram P.",
      images: [img("1603302576837-37561b2e2302"), img("1593642702821-c8da6771f0c6")],
      attributes: { brand: "ASUS", model: "ROG Strix G15", processor: "AMD Ryzen 7 6800H", ram: "16gb", storage: "1tb", has_dedicated_gpu: "yes", graphics_card: "NVIDIA RTX 3060 6GB", screen_size: 15.6, battery_health: 81, purchase_date: "2023-03-02", under_warranty: "no", known_issues: "Small scuff on the lid. Battery lasts about 3 hours on light use." },
    },
  },
  {
    category: "sofas",
    daysAgo: 4,
    data: {
      title: "L-shaped leather sectional, 5 seater",
      description: "Genuine leather sectional in tan. Very comfortable, no tears. The chaise can go on either side.",
      price: 42000,
      condition: "good",
      location: "Saket, New Delhi",
      sellerName: "Meera J.",
      images: [img("1550254478-ead40cc54513"), img("1540574163026-643ea20ade25")],
      attributes: { material: "leather", seating_capacity: 5, pet_friendly: "no", dimensions: { length: 280, width: 170, height: 88 }, color: "Tan", known_issues: "Slight fading on one armrest from sunlight." },
    },
  },
  {
    category: "mobile-phones",
    daysAgo: 6,
    data: {
      title: "OnePlus 11R, 128 GB, Sonic Black",
      description: "Great phone, 100W charging is a dream. Minor scratches on the back. Charger and cable included.",
      price: 21000,
      condition: "fair",
      location: "Gachibowli, Hyderabad",
      sellerName: "Arjun T.",
      images: [img("1601784551446-20c9e07cdbdb")],
      attributes: { brand: "OnePlus", model: "11R", storage: "128gb", ram: "8gb", battery_health: 88, original_box: false, accessories: ["charger", "cable"], under_warranty: "no" },
    },
  },
  {
    category: "laptops",
    daysAgo: 8,
    data: {
      title: "Dell XPS 13 (2022), i7, 16 GB RAM",
      description: "Premium ultrabook with an InfinityEdge display. Perfect for work and travel. Clean Windows 11 install.",
      price: 55000,
      condition: "good",
      location: "Baner, Pune",
      sellerName: "Neha D.",
      images: [img("1525547719571-a2d4ac8945e2")],
      attributes: { brand: "Dell", model: "XPS 13 9315", processor: "Intel Core i7-1250U", ram: "16gb", storage: "512gb", has_dedicated_gpu: "no", screen_size: 13.4, under_warranty: "no" },
    },
  },
  {
    category: "sofas",
    daysAgo: 10,
    data: {
      title: "Velvet two-seater, emerald green",
      description: "Statement piece from a design studio. Gold-finish legs. Lightly used in a guest room.",
      price: 18500,
      condition: "like_new",
      location: "Bandra West, Mumbai",
      sellerName: "Zoya F.",
      images: [img("1567016432779-094069958ea5")],
      attributes: { material: "velvet", seating_capacity: 2, pet_friendly: "no", dimensions: { length: 160, width: 85, height: 80 }, color: "Emerald green" },
    },
  },
];

export async function seed(db: Db) {
  const fieldIds = new Map<string, number>();
  for (const field of FIELDS) {
    const created = await createField(db, field);
    fieldIds.set(created.key, created.id);
  }

  const categoryIds = new Map<string, number>();
  for (const { layout, ...category } of CATEGORIES) {
    const created = await createCategory(db, category);
    categoryIds.set(created.slug, created.id);
    await saveCategoryLayout(db, created.id, {
      fields: layout.map(([key, opts = {}]) => ({ fieldId: fieldIds.get(key), ...opts })),
    });
  }

  for (const listing of LISTINGS) {
    const { id } = await createListing(db, { ...listing.data, categoryId: categoryIds.get(listing.category) });
    const createdAt = new Date(Date.now() - listing.daysAgo * 86_400_000);
    await db.update(listings).set({ createdAt, updatedAt: createdAt }).where(eq(listings.id, id));
  }
}
