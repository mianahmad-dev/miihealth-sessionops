#!/bin/sh
set -e

echo "[startup] Running database migrations..."

node - <<'EOF'
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL || '/data/sessionops.db';
const sqlite = new Database(dbUrl);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Drizzle migrations tracking table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    hash  TEXT    NOT NULL UNIQUE,
    created_at INTEGER
  )
`);

const migrationsDir = path.join(__dirname, 'drizzle');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const hash = file.replace('.sql', '');
  const already = sqlite.prepare('SELECT id FROM __drizzle_migrations WHERE hash = ?').get(hash);
  if (already) {
    console.log(`[startup] Skipping (already applied): ${file}`);
    continue;
  }
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    sqlite.exec(stmt);
  }
  sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(hash, Date.now());
  console.log(`[startup] Applied: ${file}`);
}

sqlite.close();
console.log('[startup] Migrations done.');
EOF

echo "[startup] Starting server..."
exec node_modules/.bin/next start
