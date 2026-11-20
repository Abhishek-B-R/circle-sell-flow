import { FieldLibrary } from "@/components/admin/FieldLibrary";
import { getDb } from "@/server/db";
import { listFields } from "@/server/services/fields";

export const dynamic = "force-dynamic";
export const metadata = { title: "Field library" };

export default async function FieldLibraryPage() {
  const fields = await listFields(await getDb(), { includeArchived: true });
  return <FieldLibrary initialFields={fields} />;
}
