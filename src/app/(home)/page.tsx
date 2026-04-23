"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  FileSpreadsheet, ScanSearch,
  Layers, ArrowLeftRight, Clock, Trash2, X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useActivityStore, ToolId } from "@/store/activity/activityStore"
import { useActivitySync } from "@/hooks/useActivitySync"

// ── Tool config ──────────────────────────────────────────────────────────────

const tools = [
  {
    title: "استخراج Excel",
    icon: FileSpreadsheet,
    href: "/excel-extractor",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-200 dark:ring-emerald-800",
    shadow: "hover:shadow-emerald-100 dark:hover:shadow-emerald-900/30",
  },
  {
    title: "كشف التكرار",
    icon: ScanSearch,
    href: "/duplicate-detector",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/30 ring-1 ring-violet-200 dark:ring-violet-800",
    shadow: "hover:shadow-violet-100 dark:hover:shadow-violet-900/30",
  },
  {
    title: "دمج الملفات",
    icon: Layers,
    href: "/excel-merger",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-900/30 ring-1 ring-sky-200 dark:ring-sky-800",
    shadow: "hover:shadow-sky-100 dark:hover:shadow-sky-900/30",
  },
  {
    title: "مقارنة الملفات",
    icon: ArrowLeftRight,
    href: "/excel-compare",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/30 ring-1 ring-orange-200 dark:ring-orange-800",
    shadow: "hover:shadow-orange-100 dark:hover:shadow-orange-900/30",
  },
]

// ── Tool metadata map ─────────────────────────────────────────────────────────

const TOOL_META: Record<ToolId, { label: string; icon: React.ElementType; color: string; bg: string; href: string }> = {
  "excel-extractor": {
    label: "استخراج Excel",
    icon: FileSpreadsheet,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    href: "/excel-extractor",
  },
  "duplicate-detector": {
    label: "كشف التكرار",
    icon: ScanSearch,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-900/30",
    href: "/duplicate-detector",
  },
  "excel-merger": {
    label: "دمج الملفات",
    icon: Layers,
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-900/30",
    href: "/excel-merger",
  },
  "excel-compare": {
    label: "مقارنة الملفات",
    icon: ArrowLeftRight,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-900/30",
    href: "/excel-compare",
  },
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1) return "الآن"
  if (mins < 60) return `منذ ${mins} دقيقة`
  if (hours < 24) return `منذ ${hours} ساعة`
  if (days === 1) return "أمس"
  return `منذ ${days} يوم`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PortalPage() {
  const { entries, clear, remove } = useActivityStore()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useActivitySync()

  return (
    <div className="flex flex-col gap-6 py-8 w-full max-w-6xl mx-auto">

      {/* ── Two-panel layout: activity RIGHT, tools LEFT (RTL: first child = right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">

        {/* ── RIGHT panel (first in RTL): Recent activity ── */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">العمليات الأخيرة</h2>
              {mounted && entries.length > 0 && (
                <Badge variant="secondary" className="text-xs h-5">{entries.length}</Badge>
              )}
            </div>
            {mounted && entries.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                className="gap-1.5 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/5 h-7"
              >
                <Trash2 className="w-3 h-3" />
                مسح
              </Button>
            )}
          </div>

          {!mounted || entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 border rounded-xl border-dashed text-center text-muted-foreground">
              <Clock className="w-8 h-8 mb-3 opacity-20" />
              <p className="text-sm">لا توجد عمليات بعد</p>
              <p className="text-xs mt-1 opacity-70">ستظهر هنا بعد استخدام أي أداة</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {entries.map((entry) => {
                const meta = TOOL_META[entry.tool]
                const Icon = meta.icon
                return (
                  <div key={entry.id} className="relative group">
                    <Link
                      href={meta.href}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors block"
                    >
                      {/* Tool icon */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-medium leading-snug truncate">{entry.label}</p>
                        {entry.detail && (
                          <p className="text-xs text-muted-foreground truncate">{entry.detail}</p>
                        )}
                        <div className="flex items-center gap-2 pt-0.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 px-1 ${meta.color}`}
                          >
                            {meta.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelative(entry.at)}
                          </span>
                        </div>
                      </div>

                      {/* Spacer for remove button */}
                      <div className="w-4 shrink-0" />
                    </Link>

                    {/* Remove — absolute so it doesn't interfere with the Link */}
                    <button
                      onClick={() => remove(entry.id)}
                      className="absolute top-2.5 left-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      aria-label="إزالة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── LEFT panel (second in RTL): Tool icons ── */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">الأدوات المتاحة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`group flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 border-transparent hover:border-current/10 transition-all duration-200 hover:shadow-lg ${tool.shadow} cursor-pointer select-none`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm ${tool.bg} transition-transform duration-200 group-hover:scale-105`}>
                    <Icon className={`w-8 h-8 ${tool.color}`} />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight text-foreground">
                    {tool.title}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
