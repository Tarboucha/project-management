"use client"

import { useEffect, useRef } from "react"
import { useAuthStore } from "@/lib/stores/auth-store"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { fetchActor, isInitialized } = useAuthStore()
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!isInitialized && !hasInitialized.current) {
      hasInitialized.current = true
      fetchActor()
    }
  }, [fetchActor, isInitialized])

  return <>{children}</>
}
