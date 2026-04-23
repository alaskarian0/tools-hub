import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var __toolsHubPgPool: Pool | undefined
}

export function getDbPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured")
  }

  if (!global.__toolsHubPgPool) {
    global.__toolsHubPgPool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  }

  return global.__toolsHubPgPool
}

export async function ensureExtractedSelectionsTable() {
  const pool = getDbPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS extracted_selections (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      headers JSONB NOT NULL,
      rows JSONB NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}
