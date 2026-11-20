import "./env";
import { rmSync } from "node:fs";
import { sql } from "drizzle-orm";
import { createDb, migrate, seedIfEmpty } from "../src/server/db/client";

// Wipes everything and reloads the sample data.
if (process.env.DATABASE_URL) {
  if (!process.argv.includes("--yes")) {
    console.error("This drops every table in DATABASE_URL. Re-run with `npm run db:reset -- --yes` to confirm.");
    process.exit(1);
  }
  const db = await createDb();
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`drop table if exists listings, category_fields, field_definitions, categories cascade`);
} else {
  rmSync(".data/pglite", { recursive: true, force: true });
}

const db = await createDb();
await migrate(db);
await seedIfEmpty(db);
console.log("Database reset with sample data.");
process.exit(0);
