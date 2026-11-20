import "./env";
import { createDb, migrate } from "../src/server/db/client";

const db = await createDb();
await migrate(db);
console.log(`Migrations applied (${process.env.DATABASE_URL ? "Postgres" : "embedded PGlite in ./.data"}).`);
process.exit(0);
