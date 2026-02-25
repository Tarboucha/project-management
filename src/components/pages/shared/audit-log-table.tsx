"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDown, ChevronRight } from "lucide-react"

export interface AuditEntry {
  id: string
  entityType: string
  entityId: string
  action: "CREATE" | "UPDATE" | "END" | "DELETE"
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  actor: { id: string; firstName: string; lastName: string } | null
  createdAt: string
  version?: number | null
}

interface AuditLogTableProps {
  entries: AuditEntry[]
  showEntityType?: boolean
}

const HIDDEN_FIELDS = new Set([
  "id", "createdAt", "modifiedAt", "deletedAt", "version",
  "createdById", "projectId", "programId", "milestoneId",
  "taskId", "actorId", "supabaseUserId", "assignedAt",
])

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "\u2014"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return value.toLocaleString()
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value).toLocaleDateString()
    }
    return value
  }
  return JSON.stringify(value)
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

const actionBadgeVariant = (action: string) => {
  switch (action) {
    case "CREATE": return "default" as const
    case "UPDATE": return "secondary" as const
    case "DELETE": return "destructive" as const
    case "END": return "outline" as const
    default: return "outline" as const
  }
}

function visibleFields(data: Record<string, unknown>): [string, unknown][] {
  return Object.entries(data).filter(([key]) => !HIDDEN_FIELDS.has(key))
}

function ChangedFields({ oldData, newData }: { oldData: Record<string, unknown>; newData: Record<string, unknown> }) {
  const fields = visibleFields(newData)
  if (fields.length === 0) return <span className="text-muted-foreground">No visible changes</span>

  return (
    <div className="space-y-0.5">
      {fields.map(([key, newVal]) => (
        <div key={key} className="text-sm">
          <span className="font-medium">{formatFieldName(key)}</span>:{" "}
          <span className="text-muted-foreground">{formatFieldValue(oldData[key])}</span>
          {" \u2192 "}
          <span>{formatFieldValue(newVal)}</span>
        </div>
      ))}
    </div>
  )
}

function EntityState({ data, label }: { data: Record<string, unknown>; label: string }) {
  const fields = visibleFields(data)
  if (fields.length === 0) return <span className="text-muted-foreground">No data</span>

  return (
    <div className="mt-2 rounded-md border bg-muted/50 p-3">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="space-y-1">
        {fields.map(([key, val]) => (
          <div key={key} className="flex gap-2 text-sm">
            <span className="font-medium min-w-[120px] shrink-0">{formatFieldName(key)}</span>
            <span>{formatFieldValue(val)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AuditLogTable({ entries, showEntityType = true }: AuditLogTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No audit entries found.</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Action</TableHead>
            {showEntityType && <TableHead>Entity</TableHead>}
            <TableHead>Changes</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isOpen = expanded.has(entry.id)
            const hasState =
              (entry.action === "CREATE" && entry.newData) ||
              (entry.action === "UPDATE" && entry.oldData) ||
              (entry.action === "DELETE" && entry.oldData)

            return (
              <TableRow key={entry.id} className="align-top">
                <TableCell>
                  {hasState && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => toggle(entry.id)}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={actionBadgeVariant(entry.action)}>
                    {entry.action}
                  </Badge>
                </TableCell>
                {showEntityType && (
                  <TableCell>
                    <span className="text-sm">{entry.entityType}</span>
                  </TableCell>
                )}
                <TableCell className="max-w-[350px]">
                  {entry.action === "UPDATE" && entry.oldData && entry.newData ? (
                    <ChangedFields oldData={entry.oldData} newData={entry.newData} />
                  ) : entry.action === "CREATE" ? (
                    <span className="text-sm text-muted-foreground">Created</span>
                  ) : entry.action === "DELETE" ? (
                    <span className="text-sm text-muted-foreground">Deleted</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">{entry.action}</span>
                  )}

                  {isOpen && entry.action === "CREATE" && entry.newData && (
                    <EntityState data={entry.newData} label="Initial state" />
                  )}
                  {isOpen && entry.action === "UPDATE" && entry.oldData && (
                    <EntityState data={entry.oldData} label="State before this change" />
                  )}
                  {isOpen && entry.action === "DELETE" && entry.oldData && (
                    <EntityState data={entry.oldData} label="State before deletion" />
                  )}
                </TableCell>
                <TableCell>
                  {entry.actor ? (
                    <span className="text-sm">
                      {entry.actor.firstName} {entry.actor.lastName}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">System</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground" title={new Date(entry.createdAt).toLocaleString()}>
                    {timeAgo(entry.createdAt)}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
