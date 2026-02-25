"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/utils/api-client"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { AuditLogDialog } from "@/components/pages/shared/audit-log-dialog"
import { MilestoneFormDialog } from "@/components/pages/projects/milestone-form-dialog"
import { Plus, Pencil, Trash2, History } from "lucide-react"
import { toast } from "sonner"

interface Milestone {
  id: string
  name: string
  description?: string | null
  dueDate: string
  createdAt: string
  createdBy: { id: string; firstName: string; lastName: string }
  _count: { tasks: number }
}

interface MilestonesSectionProps {
  projectId: string
  projectRole?: "DIRECTOR" | "MANAGER" | "CONTRIBUTOR"
}

export function MilestonesSection({ projectId, projectRole }: MilestonesSectionProps) {
  const { isAdmin } = useAuthStore()
  const admin = isAdmin()

  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingMilestone, setDeletingMilestone] = useState<Milestone | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyMilestone, setHistoryMilestone] = useState<Milestone | null>(null)

  const canManage = admin || projectRole === "DIRECTOR" || projectRole === "MANAGER"

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const res = await api.get<Milestone[]>(`/api/projects/${projectId}/milestones`)
      if (cancelled) return
      if (res.success) {
        setMilestones(res.data)
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [projectId, fetchKey])

  const refetch = () => {
    setIsLoading(true)
    setFetchKey((k) => k + 1)
  }

  const handleDelete = async () => {
    if (!deletingMilestone) return
    setDeleteLoading(true)
    const res = await api.delete(`/api/projects/${projectId}/milestones/${deletingMilestone.id}`)
    if (res.success) {
      toast.success("Milestone deleted")
      refetch()
    } else {
      toast.error("Failed to delete milestone")
    }
    setDeleteLoading(false)
    setDeleteOpen(false)
    setDeletingMilestone(null)
  }

  const isDueSoon = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diff = due.getTime() - now.getTime()
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000
  }

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date()
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Milestones ({milestones.length})</h2>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditingMilestone(null)
              setFormOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Milestone
          </Button>
        )}
      </div>

      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((milestone) => (
                <TableRow key={milestone.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{milestone.name}</span>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(milestone.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{milestone._count.tasks}</TableCell>
                  <TableCell>
                    {isOverdue(milestone.dueDate) ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : isDueSoon(milestone.dueDate) ? (
                      <Badge variant="secondary">Due Soon</Badge>
                    ) : (
                      <Badge variant="outline">On Track</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setHistoryMilestone(milestone)
                            setHistoryOpen(true)
                          }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingMilestone(milestone)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setDeletingMilestone(milestone)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MilestoneFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={refetch}
        projectId={projectId}
        milestone={editingMilestone ?? undefined}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Milestone"
        description={
          deletingMilestone
            ? `Delete milestone "${deletingMilestone.name}"? Tasks assigned to it will be unlinked.`
            : ""
        }
        isLoading={deleteLoading}
      />

      <AuditLogDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entityType="Milestone"
        entityId={historyMilestone?.id ?? ""}
        entityLabel={historyMilestone?.name ?? "Milestone"}
        apiBasePath={`/api/projects/${projectId}/audit-log`}
      />
    </div>
  )
}
