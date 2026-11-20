import "./env";
import { createDb, migrate, seedIfEmpty } from "../src/server/db/client";

const db = await createDb();
await migrate(db);
const seeded = await seedIfEmpty(db);
console.log(seeded ? "Sample categories, fields and listings loaded." : "Database already has data; nothing to seed. Use `npm run db:reset` to start over.");
process.exit(0);
