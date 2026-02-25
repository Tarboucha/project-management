"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditLogTable, type AuditEntry } from "@/components/pages/shared/audit-log-table"

interface AuditLogSectionProps {
  apiUrl: string
  title?: string
}

export function AuditLogSection({ apiUrl, title = "Recent Activity" }: AuditLogSectionProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const separator = apiUrl.includes("?") ? "&" : "?"
      const res = await api.get(`${apiUrl}${separator}limit=10`)
      if (cancelled) return
      if (res.success) {
        const paginated = res as CursorPaginatedResult<AuditEntry>
        setEntries(paginated.data)
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [apiUrl])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <AuditLogTable entries={entries} showEntityType={true} />
    </div>
  )
}
