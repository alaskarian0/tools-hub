"use client"

import { create } from "zustand"

export interface SavedExtractedSelection {
  fileName: string
  headers: string[]
  rows: Record<string, unknown>[]
  savedAt: string
}

interface ExtractedSelectionState {
  savedSelection: SavedExtractedSelection | null
  isLoading: boolean
  isInitialized: boolean
}

interface ExtractedSelectionActions {
  fetchSavedSelection: () => Promise<void>
  saveSelection: (selection: SavedExtractedSelection) => Promise<void>
  clearSavedSelection: () => Promise<void>
}

type ExtractedSelectionStore = ExtractedSelectionState & ExtractedSelectionActions

export const useExtractedSelectionStore = create<ExtractedSelectionStore>()((set) => ({
  savedSelection: null,
  isLoading: false,
  isInitialized: false,

  fetchSavedSelection: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch("/api/extracted-selections", { method: "GET" })
      if (!res.ok) throw new Error("Failed to fetch saved selection")
      const payload = (await res.json()) as { data: SavedExtractedSelection | null }
      set({ savedSelection: payload.data, isInitialized: true })
    } catch {
      set({ savedSelection: null, isInitialized: true })
    } finally {
      set({ isLoading: false })
    }
  },

  saveSelection: async (selection) => {
    set({ savedSelection: selection, isLoading: true })
    try {
      const res = await fetch("/api/extracted-selections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      })
      if (!res.ok) throw new Error("Failed to persist selection")
    } finally {
      set({ isLoading: false })
    }
  },

  clearSavedSelection: async () => {
    set({ savedSelection: null, isLoading: true })
    try {
      const res = await fetch("/api/extracted-selections", { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to clear saved selection")
    } finally {
      set({ isLoading: false })
    }
  },
}))
