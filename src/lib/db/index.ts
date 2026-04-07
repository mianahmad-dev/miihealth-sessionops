import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "./sessionops.db";

let _db: BetterSQLite3Database<typeof schema> | null = null;

function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const sqlite = new Database(DATABASE_URL);
    sqlite.pragma("journal_mode = WAL");
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_, prop) {
    return getDb()[prop as keyof BetterSQLite3Database<typeof schema>];
  },
});
