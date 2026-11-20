import { CategoryList } from "@/components/admin/CategoryList";
import { getDb } from "@/server/db";
import { listCategories } from "@/server/services/categories";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const categories = await listCategories(await getDb(), { includeInactive: true });
  return <CategoryList categories={JSON.parse(JSON.stringify(categories))} />;
}
