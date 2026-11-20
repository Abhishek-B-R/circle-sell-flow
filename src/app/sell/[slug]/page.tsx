import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellForm } from "@/components/sell/SellForm";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { getCategory, getCategoryFields } from "@/server/services/categories";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const db = await getDb();
  try {
    const category = await getCategory(db, slug);
    if (!category.isActive) notFound();
    return { db, category };
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { category } = await load((await params).slug);
  return { title: `Sell in ${category.name}` };
}

export default async function SellCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { db, category } = await load((await params).slug);
  const fields = await getCategoryFields(db, category.id);
  return <SellForm category={{ id: category.id, name: category.name, slug: category.slug, icon: category.icon }} fields={fields} />;
}
