"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileUploadZone } from "@/components/features/excel-extractor/file-upload-zone"
import { DuplicatesResult } from "./duplicates-result"
import { findDuplicates } from "@/lib/detectDuplicates"
import { toast } from "sonner"
import { X } from "lucide-react"
import { useActivityStore } from "@/store/activity/activityStore"

export function ExcelTab() {
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [column, setColumn] = useState("")
  const [results, setResults] = useState<ReturnType<typeof findDuplicates> | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const logActivity = useActivityStore((s) => s.log)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
        if (parsed.length === 0) {
          toast.error("الملف فارغ")
          return
        }
        setFileName(file.name)
        setHeaders(Object.keys(parsed[0]))
        setRows(parsed)
        setColumn("")
        setResults(null)
        toast.success(`تم تحميل ${parsed.length} صف`)
      } catch {
        toast.error("تعذّر قراءة الملف")
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function scan() {
    if (!column) {
      toast.error("اختر العمود أولاً")
      return
    }
    const values = rows.map((r) => String(r[column] ?? ""))
    const dupes = findDuplicates(values)
    setTotalRows(values.length)
    setResults(dupes)
    logActivity({
      tool: "duplicate-detector",
      label: `فحص "${fileName}" — عمود: ${column}`,
      detail: `${dupes.length} قيمة مكررة من أصل ${values.length} صف`,
    })
  }

  function reset() {
    setFileName("")
    setHeaders([])
    setRows([])
    setColumn("")
    setResults(null)
    setTotalRows(0)
  }

  if (!fileName) {
    return <FileUploadZone onFile={handleFile} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{fileName}</p>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
          <X className="w-4 h-4" />
          إعادة تعيين
        </Button>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label>العمود المراد فحصه</Label>
          <Select value={column} onValueChange={setColumn}>
            <SelectTrigger>
              <SelectValue placeholder="اختر عموداً" />
            </SelectTrigger>
            <SelectContent>
              {headers.map((h) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={scan} disabled={!column}>
          فحص التكرار
        </Button>
      </div>

      {results !== null && (
        <DuplicatesResult
          results={results}
          totalRows={totalRows}
          allRows={rows}
          headers={headers}
          scannedColumn={column}
        />
      )}
    </div>
  )
}
