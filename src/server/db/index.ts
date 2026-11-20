import { createDb, type Db } from "./client";

/**
 * One database handle per server process. `globalThis` keeps it alive across
 * Next.js hot reloads in development, so PGlite isn't opened twice.
 */
const globalForDb = globalThis as unknown as { __circleDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  return (globalForDb.__circleDb ??= createDb({ autoSetup: true }));
}

export type { Db };
