import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "./sessionops.db";

const sqlite = new Database(DATABASE_URL);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
