import path from "node:path";
import { mkdirSync } from "node:fs";
import { count } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Either driver below satisfies this; services only depend on it. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

interface CreateDbOptions {
  /** Embedded mode only: apply migrations and load sample data on first boot. */
  autoSetup?: boolean;
  /** Embedded mode only: "memory://" for tests. */
  dataDir?: string;
}

/**
 * DATABASE_URL set   -> any Postgres (Neon in the demo), via postgres.js.
 * DATABASE_URL unset -> PGlite, a real Postgres compiled to WASM, stored in
 *                       ./.data. Same SQL, same migrations, zero setup.
 */
export async function createDb(options: CreateDbOptions = {}): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url && !options.dataDir) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, { prepare: false, max: 5 });
    return drizzle(client, { schema }) as unknown as Db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dataDir = options.dataDir ?? path.join(process.cwd(), ".data", "pglite");
  if (!dataDir.startsWith("memory://")) mkdirSync(dataDir, { recursive: true });
  const db = drizzle(new PGlite(dataDir), { schema }) as unknown as Db;

  if (options.autoSetup) {
    await migrate(db, false);
    await seedIfEmpty(db);
  }
  return db;
}

export async function migrate(db: Db, isPostgresJs = Boolean(process.env.DATABASE_URL)) {
  if (isPostgresJs) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder: MIGRATIONS });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: MIGRATIONS });
  }
}

export async function seedIfEmpty(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(schema.categories);
  if (n > 0) return false;
  const { seed } = await import("./seed");
  await seed(db);
  return true;
}
