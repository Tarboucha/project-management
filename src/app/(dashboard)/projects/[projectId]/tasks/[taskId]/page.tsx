"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth-store"
import { api } from "@/lib/utils/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StateBadge } from "@/components/pages/shared/state-badge"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { AuditLogSection } from "@/components/pages/shared/audit-log-section"
import { TaskFormDialog } from "@/components/pages/projects/task-form-dialog"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Check, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react"
import { toast } from "sonner"

interface TaskDetail {
  id: string
  objective: string
  details?: string | null
  state: "ACTIVE" | "ENDED"
  priority: "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT"
  progress: number
  startDate: string
  endDate?: string | null
  budgetEstimated?: number | string | null
  milestoneId?: string | null
  milestone?: { id: string; name: string } | null
  createdBy: { id: string; firstName: string; lastName: string }
  contributors: Array<{
    actorId?: string
    actor: { id: string; firstName: string; lastName: string; email: string }
  }>
  _count: { deliverables: number; timeEntries: number }
}

interface ProjectInfo {
  id: string
  name: string
  members: Array<{
    role: "DIRECTOR" | "MANAGER" | "CONTRIBUTOR"
    actorId: string
    actor: { id: string; firstName: string; lastName: string; email: string }
  }>
}

const priorityVariant = (priority: string) => {
  switch (priority) {
    case "URGENT": return "destructive" as const
    case "HIGH": return "destructive" as const
    case "MEDIUM": return "secondary" as const
    default: return "outline" as const
  }
}

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>()
  const router = useRouter()
  const actor = useAuthStore((s) => s.actor)
  const isInitialized = useAuthStore((s) => s.isInitialized)

  const [task, setTask] = useState<TaskDetail | null>(null)
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Dialogs
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Remove contributor
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removingContributor, setRemovingContributor] = useState<TaskDetail["contributors"][0] | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  // Add contributor
  const [addingContributor, setAddingContributor] = useState(false)

  // Progress editing
  const [progressValue, setProgressValue] = useState<number>(0)
  const [savingProgress, setSavingProgress] = useState(false)

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const [taskRes, projectRes] = await Promise.all([
        api.get<TaskDetail>(`/api/projects/${projectId}/tasks/${taskId}`),
        api.get<ProjectInfo>(`/api/projects/${projectId}`),
      ])
      if (cancelled) return

      if (taskRes.success) {
        setTask(taskRes.data)
        setProgressValue(taskRes.data.progress)
      } else {
        toast.error("Task not found")
        router.push(`/projects/${projectId}`)
      }

      if (projectRes.success) {
        setProject(projectRes.data)
      }

      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [projectId, taskId, router, fetchKey])

  const refetch = () => {
    setIsLoading(true)
    setFetchKey((k) => k + 1)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    const res = await api.delete(`/api/projects/${projectId}/tasks/${taskId}`)
    if (res.success) {
      toast.success("Task deleted")
      router.push(`/projects/${projectId}`)
    } else {
      toast.error("Failed to delete task")
    }
    setIsDeleting(false)
    setDeleteOpen(false)
  }

  const handleRemoveContributor = async () => {
    if (!removingContributor) return
    setRemoveLoading(true)
    const res = await api.delete(
      `/api/projects/${projectId}/tasks/${taskId}/contributors/${removingContributor.actor.id}`
    )
    if (res.success) {
      toast.success("Contributor removed")
      refetch()
    } else {
      toast.error("Failed to remove contributor")
    }
    setRemoveLoading(false)
    setRemoveOpen(false)
    setRemovingContributor(null)
  }

  const handleAddContributor = async (actorId: string) => {
    setAddingContributor(true)
    const res = await api.post(`/api/projects/${projectId}/tasks/${taskId}/contributors`, { actorId })
    if (res.success) {
      toast.success("Contributor added")
      refetch()
    } else {
      toast.error("Failed to add contributor")
    }
    setAddingContributor(false)
  }

  const handleProgressSave = async () => {
    if (!task || progressValue === task.progress) return
    setSavingProgress(true)
    const res = await api.patch(`/api/projects/${projectId}/tasks/${taskId}`, {
      progress: progressValue,
    })
    if (res.success) {
      toast.success("Progress updated")
      setTask({ ...task, progress: progressValue })
    } else {
      toast.error("Failed to update progress")
      setProgressValue(task.progress)
    }
    setSavingProgress(false)
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString()

  // Permissions
  const admin = actor?.systemRole === "ADMIN"
  const myMembership = project?.members.find((m) => m.actorId === actor?.id)
  const myProjectRole = myMembership?.role
  const canManage = admin || myProjectRole === "DIRECTOR" || myProjectRole === "MANAGER"

  if (isLoading || !isInitialized) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!task) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{task.objective}</h1>
            <StateBadge state={task.state} />
            <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
          </div>
          {project && (
            <div className="ml-10 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Project:</span>
              <Link href={`/projects/${projectId}`} className="hover:underline">
                {project.name}
              </Link>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{progressValue}%</span>
                  {progressValue !== task.progress && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={handleProgressSave}
                      disabled={savingProgress}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Slider
                  value={[progressValue]}
                  onValueChange={([v]) => setProgressValue(v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            ) : (
              <>
                <div className="text-lg font-semibold">{task.progress}%</div>
                <Progress value={task.progress} className="mt-2 h-2" />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{formatDate(task.startDate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">End Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {task.endDate ? formatDate(task.endDate) : "\u2014"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {task.budgetEstimated
                ? `${Number(task.budgetEstimated).toLocaleString()} EUR`
                : "\u2014"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Milestone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {task.milestone ? task.milestone.name : "\u2014"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      {task.details && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Details</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{task.details}</p>
          </div>
        </>
      )}

      <Separator />

      {/* Contributors */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Contributors ({task.contributors.length})</h2>
          {canManage && project && (() => {
            const existingIds = new Set(task.contributors.map((c) => c.actor.id))
            const eligible = project.members.filter((m) => !existingIds.has(m.actorId))
            if (eligible.length === 0) return null
            return (
              <Select
                value=""
                onValueChange={handleAddContributor}
                disabled={addingContributor}
              >
                <SelectTrigger className="w-auto gap-1 h-8 px-2">
                  <UserPlus className="h-4 w-4" />
                  <SelectValue placeholder="Add..." />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((m) => (
                    <SelectItem key={m.actorId} value={m.actorId}>
                      {m.actor.firstName} {m.actor.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          })()}
        </div>
        {task.contributors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contributors assigned.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  {canManage && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.contributors.map((contributor) => (
                  <TableRow key={contributor.actor.id}>
                    <TableCell className="font-medium">
                      {contributor.actor.firstName} {contributor.actor.lastName}
                      {contributor.actor.id === actor?.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contributor.actor.email}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setRemovingContributor(contributor)
                            setRemoveOpen(true)
                          }}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Audit Log */}
      {canManage && (
        <>
          <Separator />
          <AuditLogSection
            apiUrl={`/api/projects/${projectId}/audit-log?entityType=Task&entityId=${taskId}`}
            title="Task History"
          />
        </>
      )}

      {/* Dialogs */}
      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={refetch}
        projectId={projectId}
        task={task}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Task"
        description={`Delete task "${task.objective}"? This action cannot be undone.`}
        isLoading={isDeleting}
      />

      <DeleteConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={handleRemoveContributor}
        title="Remove Contributor"
        description={
          removingContributor
            ? `Remove ${removingContributor.actor.firstName} ${removingContributor.actor.lastName} from this task?`
            : ""
        }
        isLoading={removeLoading}
      />
    </div>
  )
}
