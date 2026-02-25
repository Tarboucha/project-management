"use client"

import { useAuthStore } from "@/lib/stores/auth-store"
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

interface AuthPageWrapperProps {
  children: React.ReactNode
}

export function AuthPageWrapper({ children }: AuthPageWrapperProps) {
  const { actor, isLoading, isInitialized } = useAuthStore()
  const router = useRouter()
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (isInitialized && !isLoading && actor && !hasRedirected.current) {
      hasRedirected.current = true
      router.push("/dashboard")
    }
  }, [actor, isInitialized, isLoading, router])

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (actor) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    )
  }

  return <>{children}</>
}
