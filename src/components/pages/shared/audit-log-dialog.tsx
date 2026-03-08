"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditLogTable } from "@/components/pages/shared/audit-log-table"
import type { AuditEntry } from "@/types"

interface AuditLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableName: string
  recordId: string
  entityLabel: string
  apiBasePath: string
}

export function AuditLogDialog({
  open,
  onOpenChange,
  tableName,
  recordId,
  entityLabel,
  apiBasePath,
}: AuditLogDialogProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !recordId) return
    let cancelled = false

    const doFetch = async () => {
      setIsLoading(true)
      const params = new URLSearchParams()
      params.set("tableName", tableName)
      params.set("recordId", recordId)
      params.set("limit", "50")

      const res = await api.get(`${apiBasePath}?${params}`)
      if (cancelled) return
      if (res.success) {
        const paginated = res as CursorPaginatedResult<AuditEntry>
        setEntries(paginated.data)
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [open, recordId, tableName, apiBasePath])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>History: {entityLabel}</DialogTitle>
          <DialogDescription>
            Audit trail for this {tableName.replace(/_/g, " ")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-3 p-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="p-1">
              <AuditLogTable entries={entries} showEntityType={false} />
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
