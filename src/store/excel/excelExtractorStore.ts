"use client"

import { create } from "zustand"
import type { ColorRule, ColumnColorRules } from "@/components/features/excel-extractor/color-rule-modal"
import apiClient from "@/lib/axiosClients"

const isRemoteSyncEnabled = process.env.NEXT_PUBLIC_ENABLE_REMOTE_EXCEL_SYNC === "true"

// ── Recent file entry ──────────────────────────────────────────────────────────
export interface RecentFileEntry {
  id?: number           // DB id (present after sync, absent before first save)
  fileName: string
  uploadedAt: string    // ISO string
  rowCount: number
  headers: string[]
  colorRules: ColumnColorRules
  selectedColumns: string[]
}

// ── Store types ────────────────────────────────────────────────────────────────
interface ExcelExtractorState {
  filterColumn: string
  filterValue: string
  selectedColumns: string[]
  colorRules: ColumnColorRules
  recentFiles: RecentFileEntry[]
  settingsRestoredFrom: string | null
  isInitialized: boolean
}

interface ExcelExtractorActions {
  initialize: () => Promise<void>
  setFilterColumn: (col: string) => void
  setFilterValue: (val: string) => void
  setSelectedColumns: (cols: string[]) => void
  toggleColumn: (col: string) => void
  setColorRules: (rules: ColumnColorRules) => void
  updateColorRule: (col: string, rule: ColorRule | null) => void
  addRecentFile: (entry: RecentFileEntry) => void
  restoreFromRecent: (entry: RecentFileEntry) => void
  clearRecentFiles: () => void
  removeRecentFile: (fileId: number | string) => void
  resetSettings: () => void
  clearRestoredHint: () => void
  _syncSettings: (settings: { filterColumn: string; filterValue: string; selectedColumns: string[]; colorRules: ColumnColorRules }) => void
}

type ExcelExtractorStore = ExcelExtractorState & ExcelExtractorActions

const defaultState: ExcelExtractorState = {
  filterColumn: "",
  filterValue: "",
  selectedColumns: [],
  colorRules: {},
  recentFiles: [],
  settingsRestoredFrom: null,
  isInitialized: false,
}

// Debounce helper
let settingsSyncTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSyncSettings(settings: Record<string, unknown>) {
  if (!isRemoteSyncEnabled) return
  if (settingsSyncTimer) clearTimeout(settingsSyncTimer)
  settingsSyncTimer = setTimeout(() => {
    apiClient.put("/settings/excel-extractor", { settings }).catch(() => {/* silent */})
  }, 600)
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const useExcelExtractorStore = create<ExcelExtractorStore>()((set, get) => ({
  ...defaultState,

  // ── Initialize from API ──────────────────────────────────────────────────────
  initialize: async () => {
    if (get().isInitialized) return
    // Clean up old localStorage key from before the migration
    if (typeof window !== "undefined") {
      localStorage.removeItem("excel-extractor-store")
    }
    if (!isRemoteSyncEnabled) {
      set({ isInitialized: true })
      return
    }

    try {
      const [settingsRes, recentRes] = await Promise.all([
        apiClient.get("/settings/excel-extractor"),
        apiClient.get("/recent-files/excel-extractor"),
      ])
      type ApiSettings = { filterColumn?: string; filterValue?: string; selectedColumns?: string[]; colorRules?: ColumnColorRules }
      const s: ApiSettings = (settingsRes.data as { data?: { settings?: ApiSettings } })?.data?.settings ?? {}
      const recent: RecentFileEntry[] = ((recentRes.data as { data?: Record<string, unknown>[] })?.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as number,
        fileName: r.fileName as string,
        uploadedAt: typeof r.uploadedAt === "string" ? r.uploadedAt : new Date(r.uploadedAt as string).toISOString(),
        rowCount: r.rowCount as number,
        headers: Array.isArray(r.headers) ? r.headers as string[] : [],
        colorRules: (r.colorRules as ColumnColorRules) ?? {},
        selectedColumns: Array.isArray(r.selectedColumns) ? r.selectedColumns as string[] : [],
      }))
      set({
        filterColumn: s.filterColumn ?? "",
        filterValue: s.filterValue ?? "",
        selectedColumns: s.selectedColumns ?? [],
        colorRules: s.colorRules ?? {},
        recentFiles: recent,
        isInitialized: true,
      })
    } catch {
      set({ isInitialized: true })
    }
  },

  // ── Settings mutations (optimistic + debounced sync) ─────────────────────────
  setFilterColumn: (col) => {
    set({ filterColumn: col })
    const s = get()
    debouncedSyncSettings({ filterColumn: col, filterValue: s.filterValue, selectedColumns: s.selectedColumns, colorRules: s.colorRules })
  },

  setFilterValue: (val) => {
    set({ filterValue: val })
    const s = get()
    debouncedSyncSettings({ filterColumn: s.filterColumn, filterValue: val, selectedColumns: s.selectedColumns, colorRules: s.colorRules })
  },

  setSelectedColumns: (cols) => {
    set({ selectedColumns: cols })
    const s = get()
    debouncedSyncSettings({ filterColumn: s.filterColumn, filterValue: s.filterValue, selectedColumns: cols, colorRules: s.colorRules })
  },

  toggleColumn: (col) => {
    set((s) => {
      const next = s.selectedColumns.includes(col)
        ? s.selectedColumns.filter((c) => c !== col)
        : [...s.selectedColumns, col]
      debouncedSyncSettings({ filterColumn: s.filterColumn, filterValue: s.filterValue, selectedColumns: next, colorRules: s.colorRules })
      return { selectedColumns: next }
    })
  },

  setColorRules: (rules) => {
    set({ colorRules: rules })
    const s = get()
    debouncedSyncSettings({ filterColumn: s.filterColumn, filterValue: s.filterValue, selectedColumns: s.selectedColumns, colorRules: rules })
  },

  updateColorRule: (col, rule) => {
    set((s) => {
      const next = { ...s.colorRules }
      if (rule === null) { delete next[col] } else { next[col] = rule }
      debouncedSyncSettings({ filterColumn: s.filterColumn, filterValue: s.filterValue, selectedColumns: s.selectedColumns, colorRules: next })
      return { colorRules: next }
    })
  },

  // ── Recent files ─────────────────────────────────────────────────────────────
  addRecentFile: (entry) => {
    // Optimistic: add locally first (dedup by fileName)
    set((s) => {
      const filtered = s.recentFiles.filter((f) => f.fileName !== entry.fileName)
      return { recentFiles: [entry, ...filtered].slice(0, 5) }
    })
    if (!isRemoteSyncEnabled) return
    // Sync to API
    apiClient.post("/recent-files/excel-extractor", {
      fileName: entry.fileName,
      uploadedAt: entry.uploadedAt,
      rowCount: entry.rowCount,
      headers: entry.headers,
      colorRules: entry.colorRules,
      selectedColumns: entry.selectedColumns,
    }).then((res) => {
      // Update the local entry with the DB-assigned id
      const saved = (res.data as { data?: { id?: number } })?.data
      if (saved?.id) {
        set((s) => ({
          recentFiles: s.recentFiles.map((f) =>
            f.fileName === entry.fileName ? { ...f, id: saved.id } : f
          ),
        }))
      }
    }).catch(() => {/* silent */})
  },

  restoreFromRecent: (entry) => {
    set({
      colorRules: entry.colorRules,
      selectedColumns: entry.selectedColumns,
      filterColumn: "",
      filterValue: "",
      settingsRestoredFrom: entry.fileName,
    })
  },

  clearRecentFiles: () => {
    set({ recentFiles: [] })
    if (!isRemoteSyncEnabled) return
    apiClient.delete("/recent-files/excel-extractor").catch(() => {/* silent */})
  },

  removeRecentFile: (fileId) => {
    if (typeof fileId === "number") {
      set((s) => ({ recentFiles: s.recentFiles.filter((f) => f.id !== fileId) }))
      if (!isRemoteSyncEnabled) return
      apiClient.delete(`/recent-files/excel-extractor/${fileId}`).catch(() => {/* silent */})
    } else {
      // fallback: remove by fileName (before DB id is known)
      set((s) => ({ recentFiles: s.recentFiles.filter((f) => f.fileName !== fileId) }))
    }
  },

  // ── Reset ────────────────────────────────────────────────────────────────────
  resetSettings: () => {
    set({ filterColumn: "", filterValue: "", selectedColumns: [], colorRules: {}, settingsRestoredFrom: null })
    if (!isRemoteSyncEnabled) return
    apiClient.delete("/settings/excel-extractor").catch(() => {/* silent */})
  },

  clearRestoredHint: () => set({ settingsRestoredFrom: null }),

  _syncSettings: (settings) => {
    set(settings)
    debouncedSyncSettings(settings)
  },
}))
