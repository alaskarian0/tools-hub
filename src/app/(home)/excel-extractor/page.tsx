"use client"

import { useState, useMemo, useCallback } from "react"
import * as XLSX from "xlsx"
import { FileSpreadsheet, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { FileUploadZone } from "@/components/features/excel-extractor/file-upload-zone"
import { FilterPanel } from "@/components/features/excel-extractor/filter-panel"
import { ResultsTable } from "@/components/features/excel-extractor/results-table"
import { ExportBar } from "@/components/features/excel-extractor/export-bar"
import { ProcessingProgress, ProcessingStep } from "@/components/features/excel-extractor/processing-progress"
import {
  ColorRuleModal, ColumnColorRules, ColorRule, resolveCellColor,
} from "@/components/features/excel-extractor/color-rule-modal"
import { toast } from "sonner"

export default function ExcelExtractorPage() {
  const [step, setStep]                   = useState<ProcessingStep>("idle")
  const [fileName, setFileName]           = useState("")
  const [headers, setHeaders]             = useState<string[]>([])
  const [allRows, setAllRows]             = useState<Record<string, unknown>[]>([])
  const [filterColumn, setFilterColumn]   = useState("")
  const [filterValue, setFilterValue]     = useState("")
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys]   = useState<Set<number>>(new Set())

  // Color rules
  const [colorRules, setColorRules]       = useState<ColumnColorRules>({})
  const [colorModalCol, setColorModalCol] = useState<string | null>(null)

  // ── file parsing ─────────────────────────────────────────────────────────────
  function handleFile(file: File) {
    setStep("reading")
    const reader = new FileReader()
    reader.onload = (e) => {
      setStep("parsing")
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const wb   = XLSX.read(data, { type: "array" })
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
          if (rows.length === 0) { toast.error("الملف فارغ"); setStep("idle"); return }
          setStep("rendering")
          setTimeout(() => {
            const hdrs = Object.keys(rows[0])
            setHeaders(hdrs); setAllRows(rows); setSelectedColumns(hdrs)
            setFilterColumn(""); setFilterValue(""); setSelectedKeys(new Set())
            setColorRules({})
            setFileName(file.name.replace(/\.[^.]+$/, ""))
            setStep("done")
            toast.success(`تم تحميل ${rows.length} صف`)
            setTimeout(() => setStep("idle"), 1800)
          }, 300)
        } catch { toast.error("تعذّر قراءة الملف"); setStep("idle") }
      }, 400)
    }
    reader.onerror = () => { toast.error("فشل في قراءة الملف"); setStep("idle") }
    reader.readAsArrayBuffer(file)
  }

  // ── column toggle ─────────────────────────────────────────────────────────────
  function toggleColumn(col: string) {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  // ── filter ───────────────────────────────────────────────────────────────────
  const filteredIndices = useMemo(() => {
    if (!filterValue.trim()) return allRows.map((_, i) => i)
    const val = filterValue.trim().toLowerCase()
    return allRows.reduce<number[]>((acc, row, i) => {
      const cols = filterColumn ? [filterColumn] : headers
      if (cols.some((c) => String(row[c] ?? "").toLowerCase().includes(val))) acc.push(i)
      return acc
    }, [])
  }, [allRows, filterColumn, filterValue, headers])

  const filteredRows   = useMemo(() => filteredIndices.map((i) => allRows[i]), [filteredIndices, allRows])
  const visibleHeaders = useMemo(() => headers.filter((h) => selectedColumns.includes(h)), [headers, selectedColumns])
  const visibleRows    = useMemo(() => filteredRows.map((row) => {
    const out: Record<string, unknown> = {}
    visibleHeaders.forEach((h) => { out[h] = row[h] })
    return out
  }), [filteredRows, visibleHeaders])

  // ── selection ────────────────────────────────────────────────────────────────
  const toggleRow = useCallback((key: number) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }, [])

  function selectAllVisible() {
    setSelectedKeys((prev) => { const next = new Set(prev); filteredIndices.forEach((k) => next.add(k)); return next })
  }
  function clearAllVisible() {
    setSelectedKeys((prev) => { const next = new Set(prev); filteredIndices.forEach((k) => next.delete(k)); return next })
  }

  const selectedRows = useMemo(() =>
    [...selectedKeys]
      .filter((k) => k < allRows.length)
      .map((k) => {
        const out: Record<string, unknown> = {}
        visibleHeaders.forEach((h) => { out[h] = allRows[k][h] })
        return out
      }),
    [selectedKeys, allRows, visibleHeaders]
  )

  // ── color rules ──────────────────────────────────────────────────────────────
  function handleColorSave(rule: ColorRule | null) {
    if (!colorModalCol) return
    setColorRules((prev) => {
      const next = { ...prev }
      if (rule === null) { delete next[colorModalCol] } else { next[colorModalCol] = rule }
      return next
    })
    setColorModalCol(null)
  }

  function reset() {
    setFileName(""); setHeaders([]); setAllRows([])
    setFilterColumn(""); setFilterValue(""); setSelectedColumns([])
    setSelectedKeys(new Set()); setStep("idle"); setColorRules({})
  }

  const isProcessing = step !== "idle" && step !== "done"

  return (
    <div className="space-y-5 w-full">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">استخراج بيانات Excel</h1>
          <p className="text-sm text-muted-foreground">صفّ البيانات، لوّن الأعمدة، حدّد الصفوف، وصدّر ما تحتاجه</p>
        </div>
        {fileName && !isProcessing && (
          <Button variant="ghost" size="sm" className="mr-auto gap-1.5 text-muted-foreground" onClick={reset}>
            <X className="w-4 h-4" />
            {fileName}
          </Button>
        )}
      </div>

      {/* ── Progress ── */}
      {step !== "idle" && <ProcessingProgress step={step} />}

      {/* ── Upload ── */}
      {!isProcessing && !fileName && <FileUploadZone onFile={handleFile} />}

      {/* ── Tabs layout ── */}
      {!isProcessing && fileName && visibleHeaders.length > 0 && (
        <div className="space-y-4">

          {/* Filter panel — full width */}
          <FilterPanel
            headers={headers}
            filterColumn={filterColumn}
            filterValue={filterValue}
            selectedColumns={selectedColumns}
            onColumnChange={setFilterColumn}
            onValueChange={setFilterValue}
            onToggleColumn={toggleColumn}
            onClearFilter={() => setFilterValue("")}
          />

          {/* Tabs */}
          <Tabs defaultValue="browse">
            <TabsList className="w-full">
              <TabsTrigger value="browse" className="flex-1 gap-2">
                جميع الصفوف
                <Badge variant="secondary" className="text-xs">{filteredIndices.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="selected" className="flex-1 gap-2">
                الصفوف المحددة
                {selectedKeys.size > 0 && (
                  <Badge className="text-xs bg-primary/15 text-primary border-primary/30">{selectedKeys.size}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Browse & select ── */}
            <TabsContent value="browse" className="mt-3">
              <div className="border rounded-xl overflow-hidden">
                <ResultsTable
                  headers={visibleHeaders}
                  rows={visibleRows}
                  rowKeys={filteredIndices}
                  selectedKeys={selectedKeys}
                  onToggleRow={toggleRow}
                  onSelectAll={selectAllVisible}
                  onClearAll={clearAllVisible}
                  totalCount={filteredIndices.length}
                  colorRules={colorRules}
                  onColorHeader={(col) => setColorModalCol(col)}
                />
              </div>
              {Object.keys(colorRules).length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  انقر على رأس العمود الملوّن لتعديل قاعدة التلوين
                </p>
              )}
            </TabsContent>

            {/* ── Tab 2: Selected rows + export ── */}
            <TabsContent value="selected" className="mt-3">
              <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
                  <span className="font-semibold text-sm text-primary">الصفوف المحددة</span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
                      {selectedKeys.size} صف
                    </Badge>
                    {selectedKeys.size > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => setSelectedKeys(new Set())}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {selectedKeys.size === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-muted-foreground">
                    <FileSpreadsheet className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">انتقل إلى تبويب &quot;جميع الصفوف&quot; وحدّد ما تريد</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="overflow-auto max-h-[460px] border-b">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            {visibleHeaders.map((h) => (
                              <TableHead key={h} className="whitespace-nowrap text-right text-xs font-semibold py-2">
                                {h}
                              </TableHead>
                            ))}
                            <TableHead className="w-8" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedRows.map((row, i) => {
                            const originalKey = [...selectedKeys][i]
                            const rowColor = visibleHeaders.reduce<string | undefined>((found, h) => {
                              if (found) return found
                              return resolveCellColor(colorRules, h, row[h])
                            }, undefined)
                            return (
                              <TableRow
                                key={originalKey}
                                className="text-xs"
                                style={rowColor ? { backgroundColor: rowColor + "44" } : undefined}
                              >
                                {visibleHeaders.map((h) => {
                                  const cellColor = resolveCellColor(colorRules, h, row[h])
                                  return (
                                    <TableCell
                                      key={h}
                                      className="whitespace-nowrap text-right py-2"
                                      style={cellColor ? {
                                        backgroundColor: cellColor + "55",
                                        borderInlineStart: `3px solid ${cellColor}`,
                                      } : undefined}
                                    >
                                      {String(row[h] ?? "")}
                                    </TableCell>
                                  )
                                })}
                                <TableCell className="py-2 px-2">
                                  <button
                                    onClick={() => toggleRow(originalKey)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="p-3">
                      <ExportBar
                        headers={visibleHeaders}
                        allRows={selectedRows}
                        selectedRows={[]}
                        fileName={fileName}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ── Color Rule Modal ── */}
      {colorModalCol && (
        <ColorRuleModal
          column={colorModalCol}
          allRows={allRows}
          existingRule={colorRules[colorModalCol]}
          open={!!colorModalCol}
          onClose={() => setColorModalCol(null)}
          onSave={handleColorSave}
        />
      )}
    </div>
  )
}
