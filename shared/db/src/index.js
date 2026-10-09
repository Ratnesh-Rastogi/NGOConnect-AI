import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured before using the database.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function camelKey(key) {
  return key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function camelize(value) {
  if (Array.isArray(value)) return value.map(camelize);
  if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [camelKey(key), camelize(item)]));
}

export async function query(text, values = []) {
  const result = await pool.query(text, values);
  return result.rows.map(camelize);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  const txQuery = async (text, values = []) => {
    const result = await client.query(text, values);
    return result.rows.map(camelize);
  };
  try {
    await client.query("BEGIN");
    const result = await callback(txQuery);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool.end();
}
