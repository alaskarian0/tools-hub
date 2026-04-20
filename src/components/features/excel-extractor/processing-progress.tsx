"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export type ProcessingStep = "idle" | "reading" | "parsing" | "rendering" | "done"

const STEPS: { key: ProcessingStep; label: string; pct: number }[] = [
  { key: "reading",   label: "قراءة الملف...",       pct: 30 },
  { key: "parsing",   label: "تحليل البيانات...",    pct: 65 },
  { key: "rendering", label: "تجهيز العرض...",       pct: 90 },
  { key: "done",      label: "اكتمل بنجاح!",         pct: 100 },
]

interface ProcessingProgressProps {
  step: ProcessingStep
}

export function ProcessingProgress({ step }: ProcessingProgressProps) {
  const [displayPct, setDisplayPct] = useState(0)

  const current = STEPS.find((s) => s.key === step)
  const targetPct = current?.pct ?? 0

  useEffect(() => {
    if (targetPct === 0) { setDisplayPct(0); return }
    const timer = setTimeout(() => setDisplayPct(targetPct), 50)
    return () => clearTimeout(timer)
  }, [targetPct])

  if (step === "idle") return null

  return (
    <div className="space-y-3 py-6 px-4 border rounded-xl bg-muted/20 animate-in fade-in">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {step === "done" ? (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              اكتمل بنجاح!
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {current?.label}
            </span>
          )}
        </span>
        <span className="tabular-nums text-muted-foreground">{displayPct}%</span>
      </div>

      {/* dir="ltr" so the bar fills from right → left in RTL layout */}
      <div dir="ltr">
        <Progress value={displayPct} className="h-2 transition-all duration-500" />
      </div>

      <div className="flex justify-between">
        {[...STEPS].reverse().map(({ key, label }) => {
          const stepIndex = STEPS.findIndex((s) => s.key === key)
          const currentIndex = STEPS.findIndex((s) => s.key === step)
          const passed = stepIndex < currentIndex
          const active = key === step

          return (
            <div key={key} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors duration-300",
                  passed || active ? "bg-primary" : "bg-border",
                  active && step !== "done" && "animate-pulse"
                )}
              />
              <span className={cn(
                "text-[10px] hidden sm:block",
                active ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {label.replace("...", "")}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
