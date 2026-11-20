import { z } from "zod";

/**
 * Information every listing has, whatever the category. These live in real
 * columns (not JSON) because the marketplace sorts, filters and shows them
 * everywhere: cards, search, PDP.
 */
export const CONDITIONS = [
  { value: "new", label: "Brand new", hint: "Unused, sealed or with tags" },
  { value: "like_new", label: "Like new", hint: "Barely used, no marks" },
  { value: "good", label: "Good", hint: "Light signs of use" },
  { value: "fair", label: "Fair", hint: "Visible wear, works fine" },
] as const;

export type ListingCondition = (typeof CONDITIONS)[number]["value"];

export const conditionLabel = (value: string) => CONDITIONS.find((c) => c.value === value)?.label ?? value;

export const MAX_IMAGES = 6;

export const commonListingSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(80, "Title must be at most 80 characters"),
  description: z
    .string()
    .trim()
    .min(20, "Tell buyers a bit more (at least 20 characters)")
    .max(2000, "Description must be at most 2000 characters"),
  price: z
    .number({ error: "Enter a price" })
    .int("Price must be a whole number of rupees")
    .min(1, "Price must be at least ₹1")
    .max(10_000_000, "Price must be at most ₹1,00,00,000"),
  condition: z.enum(CONDITIONS.map((c) => c.value) as [ListingCondition, ...ListingCondition[]], { error: "Choose the condition" }),
  location: z.string().trim().min(2, "Enter your city or area").max(60),
  sellerName: z.string().trim().min(2, "Enter your name").max(40),
  images: z
    .array(z.url({ protocol: /^https?$/, error: "Image must be an http(s) link" }))
    .max(MAX_IMAGES, `At most ${MAX_IMAGES} photos`)
    .default([]),
});

export type CommonListingInput = z.input<typeof commonListingSchema>;

export const createListingSchema = commonListingSchema.extend({
  categoryId: z.number().int().positive(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

export function formatPrice(price: number) {
  return `₹${price.toLocaleString("en-IN")}`;
}

export function timeAgo(date: Date | string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  const steps: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let value = seconds;
  for (const [size, unit] of steps) {
    if (value < size) {
      if (unit === "second") return "just now";
      const n = Math.floor(value);
      return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
    }
    value /= size;
  }
  return "";
}
