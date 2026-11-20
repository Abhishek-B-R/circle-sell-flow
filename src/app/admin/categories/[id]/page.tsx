import { notFound } from "next/navigation";
import { CategoryBuilder } from "@/components/admin/CategoryBuilder";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { getCategory, getCategoryFields } from "@/server/services/categories";
import { listFields } from "@/server/services/fields";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const category = await getCategory(await getDb(), (await params).id).catch(() => null);
  return { title: category ? `${category.name} fields` : "Category" };
}

export default async function CategoryBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;
  try {
    const category = await getCategory(db, id);
    const [fields, library] = await Promise.all([getCategoryFields(db, category.id), listFields(db, { includeArchived: true })]);
    return <CategoryBuilder category={JSON.parse(JSON.stringify(category))} initialFields={fields} initialLibrary={library} />;
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}
