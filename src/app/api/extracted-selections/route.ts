import { NextResponse } from "next/server"
import { ensureExtractedSelectionsTable, getDbPool } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RECORD_ID = "excel-extractor-selected"

type SelectionPayload = {
  fileName: string
  headers: string[]
  rows: Record<string, unknown>[]
  savedAt: string
}

const MOCK_SELECTION: SelectionPayload = {
  fileName: "mock-extract",
  headers: ["الاسم", "المدينة", "الرقم"],
  rows: [
    { الاسم: "أحمد", المدينة: "الرياض", الرقم: 1001 },
    { الاسم: "سارة", المدينة: "جدة", الرقم: 1002 },
    { الاسم: "علي", المدينة: "الدمام", الرقم: 1003 },
  ],
  savedAt: new Date().toISOString(),
}

function mockModeEnabled() {
  return process.env.USE_MOCK_EXTRACTED_SELECTION === "true"
}

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL)
}

export async function GET() {
  if (mockModeEnabled()) {
    return NextResponse.json({ data: MOCK_SELECTION })
  }

  try {
    await ensureExtractedSelectionsTable()
    const pool = getDbPool()
    const result = await pool.query(
      "SELECT file_name, headers, rows, saved_at FROM extracted_selections WHERE id = $1 LIMIT 1",
      [RECORD_ID]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ data: MOCK_SELECTION })
    }

    const row = result.rows[0]
    return NextResponse.json({
      data: {
        fileName: row.file_name as string,
        headers: (row.headers as string[]) ?? [],
        rows: (row.rows as Record<string, unknown>[]) ?? [],
        savedAt: new Date(row.saved_at as string).toISOString(),
      },
    })
  } catch (error) {
    // Dev-safe fallback: if DB is unavailable, still return mock data
    return NextResponse.json({
      data: MOCK_SELECTION,
      meta: { fallback: "mock", reason: String(error) },
    })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<SelectionPayload>
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : ""
    const headers = Array.isArray(body.headers) ? body.headers.filter((h): h is string => typeof h === "string") : []
    const rows = Array.isArray(body.rows) ? body.rows : []
    const savedAt = typeof body.savedAt === "string" ? body.savedAt : new Date().toISOString()

    if (!fileName || headers.length === 0 || rows.length === 0) {
      return NextResponse.json({ message: "Invalid selection payload" }, { status: 400 })
    }

    if (!databaseConfigured()) {
      return NextResponse.json({ ok: true, meta: { fallback: "no-database" } })
    }

    await ensureExtractedSelectionsTable()
    const pool = getDbPool()
    await pool.query(
      `INSERT INTO extracted_selections (id, file_name, headers, rows, saved_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::timestamptz, NOW())
       ON CONFLICT (id) DO UPDATE SET
         file_name = EXCLUDED.file_name,
         headers = EXCLUDED.headers,
         rows = EXCLUDED.rows,
         saved_at = EXCLUDED.saved_at,
         updated_at = NOW()`,
      [RECORD_ID, fileName, JSON.stringify(headers), JSON.stringify(rows), savedAt]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to save selection", error: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    if (!databaseConfigured()) {
      return NextResponse.json({ ok: true, meta: { fallback: "no-database" } })
    }

    await ensureExtractedSelectionsTable()
    const pool = getDbPool()
    await pool.query("DELETE FROM extracted_selections WHERE id = $1", [RECORD_ID])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: true, meta: { fallback: "mock", reason: String(error) } })
  }
}
