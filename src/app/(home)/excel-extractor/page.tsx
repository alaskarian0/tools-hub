"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import * as XLSX from "xlsx"
import { CheckCircle2, FileSpreadsheet, X, Trash2 } from "lucide-react"
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
import { RecentFilesSection } from "@/components/features/excel-extractor/recent-files-section"
import {
  ColorRuleModal, ColorRule, resolveCellColor,
} from "@/components/features/excel-extractor/color-rule-modal"
import { useExcelExtractorStore } from "@/store/excel/excelExtractorStore"
import { useActivityStore } from "@/store/activity/activityStore"
import { useExcelExtractorSync } from "@/hooks/useExcelExtractorSync"
import { toast } from "sonner"

export default function ExcelExtractorPage() {
  // ── Ephemeral local state ────────────────────────────────────────────────────
  const [step, setStep]           = useState<ProcessingStep>("idle")
  const [fileName, setFileName]   = useState("")
  const [headers, setHeaders]     = useState<string[]>([])
  const [allRows, setAllRows]     = useState<Record<string, unknown>[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(new Set())
  const [colorModalCol, setColorModalCol] = useState<string | null>(null)
  const [colorModalKey, setColorModalKey] = useState(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ── Persisted store state ────────────────────────────────────────────────────
  const {
    filterColumn, setFilterColumn,
    filterValue, setFilterValue,
    selectedColumns, setSelectedColumns, toggleColumn,
    colorRules, updateColorRule,
    addRecentFile,
    recentFiles,
    settingsRestoredFrom, clearRestoredHint,
    resetSettings,
  } = useExcelExtractorStore()

  const logActivity = useActivityStore((s) => s.log)
  useExcelExtractorSync()

  // ── File parsing ─────────────────────────────────────────────────────────────
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
            setHeaders(hdrs)
            setAllRows(rows)
            setSelectedKeys(new Set())

            // Apply pre-loaded selectedColumns if they match new headers; else init to all
            const { selectedColumns: storedCols, colorRules: storedRules } =
              useExcelExtractorStore.getState()
            const matching = storedCols.filter((c) => hdrs.includes(c))
            setSelectedColumns(matching.length > 0 ? matching : hdrs)

            setFilterColumn("")
            setFilterValue("")

            const baseName = file.name.replace(/\.[^.]+$/, "")
            setFileName(baseName)
            clearRestoredHint()

            addRecentFile({
              fileName: baseName,
              uploadedAt: new Date().toISOString(),
              rowCount: rows.length,
              headers: hdrs,
              colorRules: storedRules,
              selectedColumns: matching.length > 0 ? matching : hdrs,
            })

            setStep("done")
            logActivity({
              tool: "excel-extractor",
              label: `تحميل ${rows.length} صف من "${baseName}"`,
              detail: `${hdrs.length} عمود`,
            })
            toast.success(`تم تحميل ${rows.length} صف`)
            setTimeout(() => setStep("idle"), 1800)
          }, 300)
        } catch { toast.error("تعذّر قراءة الملف"); setStep("idle") }
      }, 400)
    }
    reader.onerror = () => { toast.error("فشل في قراءة الملف"); setStep("idle") }
    reader.readAsArrayBuffer(file)
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
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

  // ── Selection ────────────────────────────────────────────────────────────────
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

  // ── Color rules ──────────────────────────────────────────────────────────────
  function handleColorSave(rule: ColorRule | null) {
    if (!colorModalCol) return
    updateColorRule(colorModalCol, rule)
    setColorModalCol(null)
  }

  // ── Reset ────────────────────────────────────────────────────────────────────
  function reset() {
    setFileName(""); setHeaders([]); setAllRows([])
    setSelectedKeys(new Set()); setStep("idle")
    resetSettings()
  }

  const isProcessing = step !== "idle" && step !== "done"
  const isFilterActive = filterValue.trim().length > 0

  return (
    <div className="space-y-5 w-full">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">استخراج بيانات Excel</h1>
          <p className="text-sm text-muted-foreground">صفّ البيانات، لوّن الأعمدة، حدّد الصفوف، وصدّر ما تحتاجه</p>
        </div>

        {/* Auto-save indicator */}
        {fileName && !isProcessing && (
          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5 mr-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            حفظ تلقائي للإعدادات
          </span>
        )}

        {/* File reset button */}
        {fileName && !isProcessing && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={reset}>
            <X className="w-4 h-4" />
            {fileName}
          </Button>
        )}
      </div>

      {/* ── Progress ── */}
      {step !== "idle" && <ProcessingProgress step={step} />}

      {/* ── Recent files (shown only when no file loaded, after client hydration) ── */}
      {mounted && !isProcessing && !fileName && recentFiles.length > 0 && (
        <RecentFilesSection
          onRestored={() => toast.success("تم استعادة إعدادات الملف السابق")}
        />
      )}

      {/* ── Pre-load banner (shown after restore, before re-upload) ── */}
      {!isProcessing && !fileName && settingsRestoredFrom && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            تم تحميل إعدادات <strong>{settingsRestoredFrom}</strong> — أعد رفع الملف لتطبيقها
          </span>
          <button
            onClick={clearRestoredHint}
            className="mr-auto text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Upload zone ── */}
      {!isProcessing && !fileName && <FileUploadZone onFile={handleFile} />}

      {/* ── Main content (tabs) ── */}
      {!isProcessing && fileName && visibleHeaders.length > 0 && (
        <div className="space-y-4">

          {/* Filter panel */}
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
                {isFilterActive && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="مفلتر" />
                )}
              </TabsTrigger>
              <TabsTrigger value="selected" className="flex-1 gap-2">
                الصفوف المحددة
                {selectedKeys.size > 0 && (
                  <Badge className="text-xs bg-primary/15 text-primary border-primary/30">
                    {selectedKeys.size}
                  </Badge>
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
                  onColorHeader={(col) => { setColorModalCol(col); setColorModalKey((k) => k + 1) }}
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

      {/* ── Color Rule Modal — key forces full remount every open so useState initializers always re-run with latest existingRule ── */}
      {colorModalCol && (
        <ColorRuleModal
          key={`${colorModalCol}-${colorModalKey}`}
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
