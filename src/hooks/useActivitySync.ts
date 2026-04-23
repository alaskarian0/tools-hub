"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/auth/authStore"
import { useActivityStore } from "@/store/activity/activityStore"

/**
 * Call this hook on the home page (or root layout).
 * It fetches the activity log from the API once per session.
 */
export function useActivitySync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { initialize, isInitialized } = useActivityStore()

  useEffect(() => {
    if (isAuthenticated && !isInitialized) {
      initialize()
    }
  }, [isAuthenticated, isInitialized, initialize])
}
