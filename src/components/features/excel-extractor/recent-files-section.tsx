"use client"

import { Clock, FileSpreadsheet, RotateCcw, Trash2, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useExcelExtractorStore, RecentFileEntry } from "@/store/excel/excelExtractorStore"

interface RecentFilesSectionProps {
  onRestored: () => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      year: "numeric", month: "short", day: "numeric",
    })
  } catch {
    return iso
  }
}

export function RecentFilesSection({ onRestored }: RecentFilesSectionProps) {
  const { recentFiles, restoreFromRecent, clearRecentFiles, removeRecentFile } =
    useExcelExtractorStore()

  if (recentFiles.length === 0) return null

  function handleRestore(entry: RecentFileEntry) {
    restoreFromRecent(entry)
    onRestored()
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">الملفات الأخيرة</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearRecentFiles}
          className="gap-1.5 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/5 h-7"
        >
          <Trash2 className="w-3 h-3" />
          مسح الكل
        </Button>
      </div>

      {/* Cards row — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
        {recentFiles.map((entry) => {
          const extraHeaders = entry.headers.length - 3
          const colorCount = Object.keys(entry.colorRules).length

          return (
            <Card
              key={entry.fileName}
              className="shrink-0 w-56 cursor-pointer border hover:border-primary/40 hover:shadow-sm transition-all snap-start group"
              onClick={() => handleRestore(entry)}
            >
              <CardContent className="p-3 space-y-2.5">
                {/* Top row: icon + name + remove */}
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0 mt-0.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-semibold leading-tight flex-1 line-clamp-2">
                    {entry.fileName}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeRecentFile(entry.id ?? entry.fileName) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                    aria-label="إزالة"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>{formatDate(entry.uploadedAt)}</span>
                </div>

                {/* Metadata badges */}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {entry.rowCount} صف
                  </Badge>
                  {entry.headers.slice(0, 3).map((h) => (
                    <Badge key={h} variant="outline" className="text-[10px] h-5 px-1.5 max-w-[80px] truncate">
                      {h}
                    </Badge>
                  ))}
                  {extraHeaders > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">
                      +{extraHeaders}
                    </Badge>
                  )}
                </div>

                {/* Color rules indicator */}
                {colorCount > 0 && (
                  <p className="text-[10px] text-primary/70">
                    {colorCount} قاعدة تلوين محفوظة
                  </p>
                )}

                {/* Restore button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs gap-1.5 text-primary hover:bg-primary/8 mt-1"
                  onClick={(e) => { e.stopPropagation(); handleRestore(entry) }}
                >
                  <RotateCcw className="w-3 h-3" />
                  استعادة الإعدادات
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
