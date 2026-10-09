import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool, closeDatabase } from "./index.js";

const schemaPath = fileURLToPath(new URL("../schema.sql", import.meta.url));
try {
  const sql = await readFile(schemaPath, "utf8");
  // The schema file contains multiple PostgreSQL statements, so send it through
  // the pool directly instead of the helper that maps result rows.
  await pool.query(sql);
  console.log("Database schema is ready.");
} catch (error) {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
