"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollText } from "lucide-react"
import { AuditLogTable } from "@/components/pages/shared/audit-log-table"
import type { AuditEntry } from "@/types"

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState("all")
  const [actionFilter, setActionFilter] = useState("all")

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const params = new URLSearchParams()
      params.set("limit", "20")
      if (entityTypeFilter !== "all") params.set("tableName", entityTypeFilter)
      if (actionFilter !== "all") params.set("action", actionFilter)

      const res = await api.get(`/api/admin/audit-log?${params}`)
      if (cancelled) return
      if (res.success) {
        const paginated = res as CursorPaginatedResult<AuditEntry>
        setEntries(paginated.data)
        setNextCursor(paginated.nextCursor)
        setHasMore(paginated.hasMore)
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [entityTypeFilter, actionFilter])

  const loadMore = async () => {
    if (!nextCursor) return
    const params = new URLSearchParams()
    params.set("cursor", nextCursor)
    params.set("limit", "20")
    if (entityTypeFilter !== "all") params.set("tableName", entityTypeFilter)
    if (actionFilter !== "all") params.set("action", actionFilter)

    const res = await api.get(`/api/admin/audit-log?${params}`)
    if (res.success) {
      const paginated = res as CursorPaginatedResult<AuditEntry>
      setEntries((prev) => [...prev, ...paginated.data])
      setNextCursor(paginated.nextCursor)
      setHasMore(paginated.hasMore)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">All system audit events</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={entityTypeFilter} onValueChange={(v) => { setIsLoading(true); setEntityTypeFilter(v) }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="program">Program</SelectItem>
            <SelectItem value="project">Project</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="deliverable">Deliverable</SelectItem>
            <SelectItem value="attachment">Attachment</SelectItem>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="project_member">Project Member</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => { setIsLoading(true); setActionFilter(v) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <ScrollText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No audit logs found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {entityTypeFilter !== "all" || actionFilter !== "all"
              ? "Try adjusting your filters"
              : "Audit entries will appear here as changes are made"}
          </p>
        </div>
      ) : (
        <>
          <AuditLogTable entries={entries} showEntityType={true} />

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
