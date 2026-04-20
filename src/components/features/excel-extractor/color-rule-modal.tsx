"use client"

import { useState, useMemo } from "react"
import { Palette, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ColorRule {
  column: string
  mode: "value" | "range"
  /** value mode: map each unique value → bg color hex */
  valueMap: Record<string, string>
  /** range mode: ordered bands [ {from, to, color} ] */
  rangeBands: RangeBand[]
}

export interface RangeBand {
  from: string   // inclusive, empty = -∞
  to: string     // inclusive, empty = +∞
  color: string
}

// A map of column → ColorRule kept in the parent
export type ColumnColorRules = Record<string, ColorRule>

// ── Palette presets ────────────────────────────────────────────────────────────

const PALETTE = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399",
  "#22d3ee", "#60a5fa", "#a78bfa", "#e879f9", "#f472b6",
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#ec4899",
  "#fca5a5", "#fdba74", "#fde68a", "#bbf7d0", "#99f6e4",
  "#e0f2fe", "#bfdbfe", "#ddd6fe", "#f5d0fe", "#fce7f3",
]

function randomColors(n: number): string[] {
  const shuffled = [...PALETTE].sort(() => Math.random() - 0.5)
  const result: string[] = []
  for (let i = 0; i < n; i++) result.push(shuffled[i % shuffled.length])
  return result
}

function gradientColors(n: number): string[] {
  // Generate evenly-spaced hues across HSL spectrum
  return Array.from({ length: n }, (_, i) => {
    const h = Math.round((i / n) * 360)
    return hslToHex(h, 80, 75)
  })
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * color).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Detect if column values look like dates
function looksLikeDates(values: string[]): boolean {
  const dateRe = /^\d{4}[-/]\d{2}[-/]\d{2}$|^\d{2}[-/]\d{2}[-/]\d{4}$/
  return values.slice(0, 20).filter(Boolean).every((v) => dateRe.test(v.trim()))
}

// ── Sub-component: color swatch picker ────────────────────────────────────────

const NO_COLOR = "none"

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {/* No-color / white swatch */}
      <button
        onClick={() => onChange(NO_COLOR)}
        className={cn(
          "w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 flex items-center justify-center",
          value === NO_COLOR ? "border-foreground scale-110" : "border-muted-foreground/40"
        )}
        style={{ background: "#ffffff" }}
        title="بدون لون"
      >
        <X className="w-3 h-3 text-muted-foreground/60" />
      </button>
      {PALETTE.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            "w-6 h-6 rounded-md border-2 transition-transform hover:scale-110",
            value === c ? "border-foreground scale-110" : "border-transparent"
          )}
          style={{ background: c }}
          title={c}
        />
      ))}
      {/* Native color input for custom */}
      <label
        className="w-6 h-6 rounded-md border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-foreground/60 relative overflow-hidden"
        title="لون مخصص"
      >
        <span className="text-[9px] text-muted-foreground leading-none">+</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

interface ColorRuleModalProps {
  column: string
  allRows: Record<string, unknown>[]
  existingRule?: ColorRule
  open: boolean
  onClose: () => void
  onSave: (rule: ColorRule | null) => void
}

export function ColorRuleModal({
  column, allRows, existingRule, open, onClose, onSave,
}: ColorRuleModalProps) {
  const rawValues = useMemo(
    () => allRows.map((r) => String(r[column] ?? "")).filter(Boolean),
    [allRows, column]
  )
  const uniqueValues = useMemo(
    () => [...new Set(rawValues)].sort((a, b) => a.localeCompare(b, "ar")),
    [rawValues]
  )
  const isDateCol = useMemo(() => looksLikeDates(uniqueValues), [uniqueValues])

  const defaultMode: "value" | "range" = isDateCol ? "range" : "value"

  const [mode, setMode] = useState<"value" | "range">(existingRule?.mode ?? defaultMode)
  const [valueMap, setValueMap] = useState<Record<string, string>>(
    () => existingRule?.valueMap ?? Object.fromEntries(
      uniqueValues.map((v, i) => [v, gradientColors(uniqueValues.length)[i]])
    )
  )
  const [rangeBands, setRangeBands] = useState<RangeBand[]>(
    () => existingRule?.rangeBands ?? [
      { from: "", to: "", color: "#fbbf24" },
    ]
  )
  const [expandedValue, setExpandedValue] = useState<string | null>(null)

  function applyGradient() {
    const colors = gradientColors(uniqueValues.length)
    setValueMap(Object.fromEntries(uniqueValues.map((v, i) => [v, colors[i]])))
  }
  function applyRandom() {
    const colors = randomColors(uniqueValues.length)
    setValueMap(Object.fromEntries(uniqueValues.map((v, i) => [v, colors[i]])))
  }

  function addBand() {
    setRangeBands((prev) => [...prev, { from: "", to: "", color: "#60a5fa" }])
  }
  function removeBand(i: number) {
    setRangeBands((prev) => prev.filter((_, idx) => idx !== i))
  }
  function updateBand(i: number, field: keyof RangeBand, val: string) {
    setRangeBands((prev) => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b))
  }

  function handleSave() {
    onSave({ column, mode, valueMap, rangeBands })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            تلوين عمود: <span className="text-primary">{column}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2 border rounded-lg p-1 bg-muted/30">
          <button
            onClick={() => setMode("value")}
            className={cn(
              "flex-1 text-sm py-1.5 rounded-md font-medium transition-colors",
              mode === "value" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            حسب القيمة
          </button>
          <button
            onClick={() => setMode("range")}
            className={cn(
              "flex-1 text-sm py-1.5 rounded-md font-medium transition-colors",
              mode === "range" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            حسب النطاق
          </button>
        </div>

        {/* ── Value mode ── */}
        {mode === "value" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {uniqueValues.length} قيمة فريدة
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={applyGradient} className="gap-1.5 text-xs h-7">
                  <Palette className="w-3 h-3" />
                  تدرج لوني
                </Button>
                <Button variant="outline" size="sm" onClick={applyRandom} className="gap-1.5 text-xs h-7">
                  <RefreshCw className="w-3 h-3" />
                  عشوائي
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
              {uniqueValues.map((val) => {
                const color = valueMap[val] ?? "#e5e7eb"
                const isNone = color === NO_COLOR
                const isOpen = expandedValue === val
                return (
                  <div key={val} className="border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-right"
                      onClick={() => setExpandedValue(isOpen ? null : val)}
                    >
                      <span
                        className="w-7 h-7 rounded-md border shrink-0 flex items-center justify-center"
                        style={{ background: isNone ? "#ffffff" : color }}
                      >
                        {isNone && <X className="w-3.5 h-3.5 text-muted-foreground/50" />}
                      </span>
                      <span className="flex-1 text-sm font-medium">{val}</span>
                      <Badge
                        variant="secondary"
                        className="text-xs shrink-0"
                        style={isNone ? undefined : { background: color + "40", borderColor: color }}
                      >
                        {rawValues.filter((v) => v === val).length} صف
                      </Badge>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 border-t bg-muted/10">
                        <ColorPicker
                          value={color}
                          onChange={(c) => setValueMap((prev) => ({ ...prev, [val]: c }))}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Range mode ── */}
        {mode === "range" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              حدد نطاقات (تاريخ أو رقم) وخصص لوناً لكل نطاق. النطاقات تُطبَّق بالترتيب.
            </p>
            <div className="space-y-2">
              {rangeBands.map((band, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">نطاق {i + 1}</span>
                    <button onClick={() => removeBand(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">من (اتركه فارغاً = بلا حد)</label>
                      <input
                        type="text"
                        value={band.from}
                        placeholder="2020-01-01"
                        onChange={(e) => updateBand(i, "from", e.target.value)}
                        className="w-full text-sm border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">إلى (اتركه فارغاً = بلا حد)</label>
                      <input
                        type="text"
                        value={band.to}
                        placeholder="2022-12-31"
                        onChange={(e) => updateBand(i, "to", e.target.value)}
                        className="w-full text-sm border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">اللون</label>
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-md border shrink-0" style={{ background: band.color }} />
                      <ColorPicker value={band.color} onChange={(c) => updateBand(i, "color", c)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addBand} className="w-full gap-1.5">
              + إضافة نطاق
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t">
          <Button onClick={handleSave} className="flex-1">حفظ التلوين</Button>
          {existingRule && (
            <Button variant="outline" onClick={() => onSave(null)} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
              <X className="w-4 h-4" />
              إزالة
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Utility: resolve cell background ──────────────────────────────────────────

export function resolveCellColor(
  rules: ColumnColorRules,
  column: string,
  value: unknown
): string | undefined {
  const rule = rules[column]
  if (!rule) return undefined
  const str = String(value ?? "")

  if (rule.mode === "value") {
    const mapped = rule.valueMap[str]
    return mapped === NO_COLOR ? undefined : mapped
  }

  if (rule.mode === "range") {
    for (const band of rule.rangeBands) {
      const afterFrom = !band.from || str >= band.from
      const beforeTo  = !band.to   || str <= band.to
      if (afterFrom && beforeTo) return band.color === NO_COLOR ? undefined : band.color
    }
  }

  return undefined
}
