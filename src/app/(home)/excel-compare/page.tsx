"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { ArrowLeftRight, Upload, Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useActivityStore } from "@/store/activity/activityStore"

type RowStatus = "added" | "deleted" | "modified" | "unchanged"

interface DiffRow {
  status: RowStatus
  data: Record<string, unknown>
  changedCols?: Set<string>
}

interface ParsedFile {
  name: string
  rows: Record<string, unknown>[]
  headers: string[]
}

function parseFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
        resolve({ name: file.name, rows, headers: rows.length > 0 ? Object.keys(rows[0]) : [] })
      } catch { reject(new Error("parse error")) }
    }
    reader.onerror = () => reject(new Error("read error"))
    reader.readAsArrayBuffer(file)
  })
}

const STATUS_LABEL: Record<RowStatus, string> = {
  added: "مضاف",
  deleted: "محذوف",
  modified: "معدّل",
  unchanged: "بدون تغيير",
}

const STATUS_ROW_CLASS: Record<RowStatus, string> = {
  added:     "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50",
  deleted:   "bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50",
  modified:  "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50",
  unchanged: "",
}

const STATUS_BADGE: Record<RowStatus, string> = {
  added:     "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300",
  deleted:   "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300",
  modified:  "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
  unchanged: "bg-muted text-muted-foreground border-border",
}

export default function ExcelComparePage() {
  const [fileA, setFileA] = useState<ParsedFile | null>(null)
  const [fileB, setFileB] = useState<ParsedFile | null>(null)
  const [keyCol, setKeyCol] = useState("")
  const [diff, setDiff] = useState<DiffRow[] | null>(null)
  const [showUnchanged, setShowUnchanged] = useState(false)
  const logActivity = useActivityStore((s) => s.log)

  async function handleDrop(slot: "A" | "B", file: File) {
    try {
      const parsed = await parseFile(file)
      if (parsed.rows.length === 0) { toast.error("الملف فارغ"); return }
      if (slot === "A") { setFileA(parsed); setKeyCol(""); setDiff(null) }
      else { setFileB(parsed); setDiff(null) }
      toast.success(`تم تحميل "${file.name}"`)
    } catch { toast.error("تعذّر قراءة الملف") }
  }

  function makeInput(slot: "A" | "B") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleDrop(slot, file)
      e.target.value = ""
    }
  }

  const commonHeaders = fileA && fileB
    ? fileA.headers.filter((h) => fileB.headers.includes(h))
    : []

  const allHeaders = fileA && fileB
    ? [...new Set([...fileA.headers, ...fileB.headers])]
    : []

  function compare() {
    if (!fileA || !fileB) { toast.error("ارفع الملفين أولاً"); return }
    if (!keyCol) { toast.error("اختر عمود المفتاح"); return }

    const mapA = new Map<string, Record<string, unknown>>()
    fileA.rows.forEach((r) => mapA.set(String(r[keyCol] ?? ""), r))
    const mapB = new Map<string, Record<string, unknown>>()
    fileB.rows.forEach((r) => mapB.set(String(r[keyCol] ?? ""), r))

    const result: DiffRow[] = []

    // Rows in A
    mapA.forEach((rowA, key) => {
      if (!mapB.has(key)) {
        result.push({ status: "deleted", data: rowA })
      } else {
        const rowB = mapB.get(key)!
        const changedCols = new Set<string>()
        allHeaders.forEach((h) => {
          if (String(rowA[h] ?? "") !== String(rowB[h] ?? "")) changedCols.add(h)
        })
        if (changedCols.size > 0) {
          result.push({ status: "modified", data: rowB, changedCols })
        } else {
          result.push({ status: "unchanged", data: rowA })
        }
      }
    })

    // Rows only in B (added)
    mapB.forEach((rowB, key) => {
      if (!mapA.has(key)) result.push({ status: "added", data: rowB })
    })

    setDiff(result)
    const added   = result.filter((r) => r.status === "added").length
    const deleted = result.filter((r) => r.status === "deleted").length
    const modified = result.filter((r) => r.status === "modified").length
    logActivity({
      tool: "excel-compare",
      label: `مقارنة "${fileA.name.replace(/\.[^.]+$/, "")}" و "${fileB.name.replace(/\.[^.]+$/, "")}"`,
      detail: `${added} مضاف · ${deleted} محذوف · ${modified} معدّل`,
    })
    toast.success(`المقارنة اكتملت: ${added} مضاف · ${deleted} محذوف · ${modified} معدّل`)
  }

  function exportDiff() {
    if (!diff) return
    const rows = diff.map((r) => ({ "الحالة": STATUS_LABEL[r.status], ...r.data }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "المقارنة")
    XLSX.writeFile(wb, "comparison.xlsx")
    toast.success("تم تصدير نتيجة المقارنة")
  }

  const displayDiff = diff
    ? (showUnchanged ? diff : diff.filter((r) => r.status !== "unchanged"))
    : []

  const counts = diff ? {
    added:     diff.filter((r) => r.status === "added").length,
    deleted:   diff.filter((r) => r.status === "deleted").length,
    modified:  diff.filter((r) => r.status === "modified").length,
    unchanged: diff.filter((r) => r.status === "unchanged").length,
  } : null

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
          <ArrowLeftRight className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">مقارنة ملفين Excel</h1>
          <p className="text-sm text-muted-foreground">اكتشف الاختلافات بين نسختين من البيانات</p>
        </div>
      </div>

      {/* Two upload zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(["A", "B"] as const).map((slot) => {
          const loaded = slot === "A" ? fileA : fileB
          const label = slot === "A" ? "الملف الأصلي (A)" : "الملف المحدّث (B)"
          const color = slot === "A" ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20" : "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20"
          const id = `upload-${slot}`
          return (
            <div key={slot}>
              <Label className="mb-2 block">{label}</Label>
              {loaded ? (
                <div className={cn("flex items-center justify-between px-4 py-3 border-2 rounded-xl", color)}>
                  <div>
                    <p className="text-sm font-medium">{loaded.name}</p>
                    <p className="text-xs text-muted-foreground">{loaded.rows.length} صف · {loaded.headers.length} عمود</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { if (slot === "A") { setFileA(null) } else { setFileB(null) } setDiff(null) }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label htmlFor={id}
                  className={cn("flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors hover:bg-muted/30", color)}>
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">انقر لرفع الملف</span>
                  <input id={id} type="file" accept=".xlsx,.xls" className="hidden" onChange={makeInput(slot)} />
                </label>
              )}
            </div>
          )
        })}
      </div>

      {/* Key column + compare */}
      {fileA && fileB && (
        <div className="flex items-end gap-3 p-5 border rounded-xl bg-muted/20">
          <div className="flex-1 space-y-1.5">
            <Label>عمود المفتاح (للمطابقة بين الملفين)</Label>
            <Select value={keyCol} onValueChange={setKeyCol}>
              <SelectTrigger>
                <SelectValue placeholder="اختر عموداً مشتركاً..." />
              </SelectTrigger>
              <SelectContent>
                {commonHeaders.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={compare} disabled={!keyCol} className="gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            مقارنة
          </Button>
        </div>
      )}

      {/* Results */}
      {diff && counts && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["added", "deleted", "modified", "unchanged"] as RowStatus[]).map((s) => (
              <div key={s} className={cn("text-center p-3 rounded-xl border", STATUS_BADGE[s])}>
                <p className="text-2xl font-bold">{counts[s]}</p>
                <p className="text-xs mt-0.5">{STATUS_LABEL[s]}</p>
              </div>
            ))}
          </div>

          {/* Legend + controls */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block"/>مضاف</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block"/>محذوف</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"/>معدّل</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowUnchanged((v) => !v)}>
                {showUnchanged ? "إخفاء" : "عرض"} بدون تغيير
              </Button>
              <Button size="sm" onClick={exportDiff} className="gap-2">
                <Download className="w-4 h-4" />
                تصدير
              </Button>
            </div>
          </div>

          {/* Diff table */}
          <div className="rounded-xl border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="whitespace-nowrap text-right font-semibold w-20">الحالة</TableHead>
                  {allHeaders.map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-right font-semibold">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayDiff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={allHeaders.length + 1} className="text-center text-muted-foreground py-10">
                      لا توجد اختلافات لعرضها
                    </TableCell>
                  </TableRow>
                ) : (
                  displayDiff.slice(0, 200).map((row, i) => (
                    <TableRow key={i} className={STATUS_ROW_CLASS[row.status]}>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={cn("text-xs", STATUS_BADGE[row.status])}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      {allHeaders.map((h) => (
                        <TableCell
                          key={h}
                          className={cn(
                            "whitespace-nowrap text-right",
                            row.changedCols?.has(h) && "font-semibold underline decoration-amber-500 decoration-2"
                          )}
                        >
                          {String(row.data[h] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {displayDiff.length > 200 && (
            <p className="text-xs text-muted-foreground text-center">يُعرض أول 200 صف — التصدير يشمل الكل</p>
          )}
        </div>
      )}
    </div>
  )
}
