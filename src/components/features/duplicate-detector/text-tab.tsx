"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DuplicatesResult } from "./duplicates-result"
import { findDuplicates } from "@/lib/detectDuplicates"
import { toast } from "sonner"
import { useActivityStore } from "@/store/activity/activityStore"

type Separator = "newline" | "comma"

export function TextTab() {
  const [text, setText] = useState("")
  const [separator, setSeparator] = useState<Separator>("newline")
  const [results, setResults] = useState<ReturnType<typeof findDuplicates> | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const logActivity = useActivityStore((s) => s.log)

  function scan() {
    if (!text.trim()) {
      toast.error("الرجاء إدخال نص أولاً")
      return
    }
    const values = separator === "newline"
      ? text.split("\n").map((v) => v.trim()).filter(Boolean)
      : text.split(",").map((v) => v.trim()).filter(Boolean)

    if (values.length < 2) {
      toast.error("أدخل قيمتين على الأقل")
      return
    }
    const dupes = findDuplicates(values)
    setTotalRows(values.length)
    setResults(dupes)
    logActivity({
      tool: "duplicate-detector",
      label: `فحص نص — ${values.length} قيمة`,
      detail: `${dupes.length} قيمة مكررة`,
    })
  }

  function reset() {
    setText("")
    setResults(null)
    setTotalRows(0)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>الفاصل بين القيم</Label>
        <div className="flex gap-3">
          {(["newline", "comma"] as Separator[]).map((sep) => (
            <label key={sep} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="separator"
                value={sep}
                checked={separator === sep}
                onChange={() => setSeparator(sep)}
                className="accent-primary"
              />
              <span className="text-sm">{sep === "newline" ? "سطر جديد" : "فاصلة"}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>الصق القيم هنا</Label>
        <Textarea
          placeholder={separator === "newline" ? "قيمة 1\nقيمة 2\nقيمة 3" : "قيمة 1, قيمة 2, قيمة 3"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="font-mono text-sm resize-none"
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={scan}>فحص التكرار</Button>
        {results !== null && (
          <Button variant="outline" onClick={reset}>إعادة تعيين</Button>
        )}
      </div>

      {results !== null && (
        <DuplicatesResult results={results} totalRows={totalRows} />
      )}
    </div>
  )
}
