"use client"

import { create } from "zustand"
import apiClient from "@/lib/axiosClients"

const isRemoteActivitySyncEnabled = process.env.NEXT_PUBLIC_ENABLE_REMOTE_ACTIVITY_SYNC === "true"

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToolId = "excel-extractor" | "duplicate-detector" | "excel-merger" | "excel-compare"

// Maps frontend ToolId slug → API enum value
const TOOL_ID_MAP: Record<ToolId, string> = {
  "excel-extractor":    "excel_extractor",
  "duplicate-detector": "duplicate_detector",
  "excel-merger":       "excel_merger",
  "excel-compare":      "excel_compare",
}

export interface ActivityEntry {
  id: number           // DB integer id
  tool: ToolId
  label: string
  detail?: string
  at: string           // ISO string (maps from DB createdAt)
}

interface ActivityState {
  entries: ActivityEntry[]
  isInitialized: boolean
}

interface ActivityActions {
  initialize: () => Promise<void>
  log: (entry: Omit<ActivityEntry, "id" | "at">) => void
  clear: () => void
  remove: (id: number) => void
}

type ActivityStore = ActivityState & ActivityActions

// ── Store ──────────────────────────────────────────────────────────────────────

export const useActivityStore = create<ActivityStore>()((set, get) => ({
  entries: [],
  isInitialized: false,

  // ── Initialize from API ──────────────────────────────────────────────────────
  initialize: async () => {
    if (get().isInitialized) return
    if (typeof window !== "undefined") {
      localStorage.removeItem("tools-hub-activity")
    }
    if (!isRemoteActivitySyncEnabled) {
      set({ isInitialized: true })
      return
    }
    try {
      const res = await apiClient.get<{ data: { items: Record<string, unknown>[] } }>("/activity?limit=20")
      const items = (res.data as { data?: { items?: Record<string, unknown>[] } })?.data?.items ?? []
      const entries: ActivityEntry[] = items.map((r: Record<string, unknown>) => ({
        id: r.id as number,
        tool: (r.tool as string).replace(/_/g, "-") as ToolId,
        label: r.label as string,
        detail: r.detail as string | undefined,
        at: r.createdAt as string,
      }))
      set({ entries, isInitialized: true })
    } catch {
      set({ isInitialized: true })
    }
  },

  // ── Log new activity (optimistic) ────────────────────────────────────────────
  log: (entry) => {
    // Optimistic: add with a temp id of 0
    const tempEntry: ActivityEntry = {
      ...entry,
      id: 0,
      at: new Date().toISOString(),
    }
    set((s) => ({ entries: [tempEntry, ...s.entries].slice(0, 20) }))

    if (!isRemoteActivitySyncEnabled) return
    // Sync to API
    apiClient.post("/activity", {
      tool: TOOL_ID_MAP[entry.tool],
      label: entry.label,
      detail: entry.detail,
    }).then((res) => {
      const saved = (res.data as { data?: { id?: number; createdAt?: string } })?.data
      if (saved?.id) {
        // Replace temp entry (id=0) with the real DB id
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === 0 && e.label === entry.label ? { ...e, id: saved.id!, at: saved.createdAt ?? e.at } : e
          ),
        }))
      }
    }).catch(() => {/* silent */})
  },

  // ── Clear all ────────────────────────────────────────────────────────────────
  clear: () => {
    set({ entries: [] })
    if (!isRemoteActivitySyncEnabled) return
    apiClient.delete("/activity").catch(() => {/* silent */})
  },

  // ── Remove single entry ──────────────────────────────────────────────────────
  remove: (id) => {
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
    if (!isRemoteActivitySyncEnabled) return
    if (id !== 0) {
      apiClient.delete(`/activity/${id}`).catch(() => {/* silent */})
    }
  },
}))
