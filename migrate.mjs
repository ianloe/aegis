/**
 * migrate.mjs — Aegis database migration runner
 *
 * Runs all .sql files in drizzle/ in filename order.
 * Tracks applied migrations in __aegis_migrations so each file
 * is applied exactly once. Does NOT require drizzle/meta/_journal.json.
 *
 * Usage:
 *   node migrate.mjs
 *
 * Requires DATABASE_URL to be set in the environment.
 */
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[migrate] ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

console.log("[migrate] Connecting to database...");
let connection;
try {
  connection = await mysql.createConnection(databaseUrl);

  // Ensure the migrations tracking table exists
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS __aegis_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Find all .sql files in the drizzle/ folder, sorted by filename
  const migrationsDir = path.resolve(__dirname, "drizzle");
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (sqlFiles.length === 0) {
    console.log("[migrate] No SQL migration files found. Nothing to do.");
    process.exit(0);
  }

  console.log(`[migrate] Found ${sqlFiles.length} migration file(s).`);

  let applied = 0;
  let skipped = 0;

  for (const filename of sqlFiles) {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");

    // Check if already applied
    const [rows] = await connection.execute(
      "SELECT id FROM __aegis_migrations WHERE filename = ?",
      [filename]
    );

    if (rows.length > 0) {
      console.log(`[migrate] Skipping (already applied): ${filename}`);
      skipped++;
      continue;
    }

    console.log(`[migrate] Applying: ${filename}`);

    // Drizzle SQL files use --> statement-breakpoint as a delimiter
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await connection.execute(statement);
      } catch (stmtErr) {
        // MySQL error codes for idempotent migration failures — safe to skip:
        // 1050 ER_TABLE_EXISTS_ERROR, 1060 ER_DUP_FIELDNAME, 1061 ER_DUP_KEY,
        // 1062 ER_DUP_ENTRY, 1068 ER_MULTIPLE_PRI_KEY,
        // 1091 ER_CANT_DROP_FIELD_OR_KEY (DROP INDEX/COLUMN that does not exist)
        const ignorable = [1050, 1060, 1061, 1062, 1068, 1091];
        if (ignorable.includes(stmtErr.errno)) {
          console.log(`[migrate]   Skipping already-applied statement (${stmtErr.code}).`);
        } else {
          throw stmtErr;
        }
      }
    }

    // Record as applied
    await connection.execute(
      "INSERT INTO __aegis_migrations (filename, checksum) VALUES (?, ?)",
      [filename, checksum]
    );

    applied++;
  }

  console.log(
    `[migrate] Done. Applied: ${applied}, Skipped (already done): ${skipped}.`
  );
} catch (err) {
  console.error("[migrate] Migration failed:", err.message);
  process.exit(1);
} finally {
  if (connection) await connection.end();
}
