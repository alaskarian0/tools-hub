"use client"

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Palette } from "lucide-react"
import { ColumnColorRules, resolveCellColor } from "./color-rule-modal"
import { cn } from "@/lib/utils"

interface ResultsTableProps {
  headers: string[]
  rows: Record<string, unknown>[]
  /** Original index in allRows for stable selection tracking */
  rowKeys: number[]
  selectedKeys: Set<number>
  onToggleRow: (key: number) => void
  onSelectAll: () => void
  onClearAll: () => void
  totalCount: number
  colorRules?: ColumnColorRules
  /** Called when user clicks a column header to open color picker */
  onColorHeader?: (col: string) => void
}

const PAGE_SIZE = 200

export function ResultsTable({
  headers,
  rows,
  rowKeys,
  selectedKeys,
  onToggleRow,
  onSelectAll,
  onClearAll,
  totalCount,
  colorRules = {},
  onColorHeader,
}: ResultsTableProps) {
  const displayRows = rows.slice(0, PAGE_SIZE)
  const displayKeys = rowKeys.slice(0, PAGE_SIZE)
  const allSelected = displayKeys.length > 0 && displayKeys.every((k) => selectedKeys.has(k))
  const someSelected = displayKeys.some((k) => selectedKeys.has(k))

  return (
    <div>
      <div className="flex items-center justify-between text-xs px-4 py-2 border-b bg-muted/10 text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{totalCount}</span> صف
          {totalCount > PAGE_SIZE && <span> · يُعرض أول {PAGE_SIZE}</span>}
        </span>
        {selectedKeys.size > 0 && (
          <span className="text-primary font-medium">
            {selectedKeys.size} محدد
          </span>
        )}
      </div>

      <div className="overflow-auto max-h-[520px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 text-center px-3">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                  onCheckedChange={() => allSelected ? onClearAll() : onSelectAll()}
                  aria-label="تحديد الكل"
                />
              </TableHead>
              {headers.map((h) => {
                const hasRule = !!colorRules[h]
                return (
                  <TableHead key={h} className="whitespace-nowrap text-right font-semibold p-0">
                    <button
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-3 w-full text-right transition-colors",
                        "hover:bg-muted/60 group",
                        hasRule && "text-primary"
                      )}
                      onClick={() => onColorHeader?.(h)}
                      title={`تلوين عمود "${h}"`}
                    >
                      {h}
                      <Palette
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-opacity",
                          hasRule ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50"
                        )}
                      />
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length + 1} className="text-center text-muted-foreground py-10">
                  لا توجد نتائج مطابقة
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row, i) => {
                const key = displayKeys[i]
                const selected = selectedKeys.has(key)

                // Row-level color: first column with a rule that resolves a color
                const rowBgColor = headers.reduce<string | undefined>((found, h) => {
                  if (found) return found
                  return resolveCellColor(colorRules, h, row[h])
                }, undefined)

                return (
                  <TableRow
                    key={key}
                    data-selected={selected}
                    className={cn(
                      "cursor-pointer",
                      selected
                        ? "data-[selected=true]:bg-primary/8 data-[selected=true]:hover:bg-primary/12"
                        : !rowBgColor && "hover:bg-muted/30"
                    )}
                    style={rowBgColor && !selected ? { backgroundColor: rowBgColor + "55" } : undefined}
                    onClick={() => onToggleRow(key)}
                  >
                    <TableCell className="w-10 text-center px-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleRow(key)}
                        aria-label="تحديد الصف"
                      />
                    </TableCell>
                    {headers.map((h) => {
                      const cellColor = resolveCellColor(colorRules, h, row[h])
                      return (
                        <TableCell
                          key={h}
                          className="whitespace-nowrap text-right"
                          style={cellColor ? {
                            backgroundColor: cellColor + "66",
                            borderInlineStart: `3px solid ${cellColor}`,
                          } : undefined}
                        >
                          {String(row[h] ?? "")}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
