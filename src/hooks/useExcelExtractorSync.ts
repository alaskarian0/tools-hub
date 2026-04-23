"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/auth/authStore"
import { useExcelExtractorStore } from "@/store/excel/excelExtractorStore"

/**
 * Call this hook at the top of the excel-extractor page.
 * It fetches settings + recent files from the API once per session,
 * but only when the user is authenticated.
 */
export function useExcelExtractorSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { initialize, isInitialized } = useExcelExtractorStore()

  useEffect(() => {
    if (isAuthenticated && !isInitialized) {
      initialize()
    }
  }, [isAuthenticated, isInitialized, initialize])
}
