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
import { StateBadge } from "@/components/pages/shared/state-badge"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { AuditLogSection } from "@/components/pages/shared/audit-log-section"
import { TaskFormDialog } from "@/components/pages/projects/task-form-dialog"
import { DeliverablesSection } from "@/components/pages/projects/deliverables-section"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Check, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { TaskDetail, ProjectDetail } from "@/types"
import { formatDate } from "@/lib/utils/format"
import { priorityVariant } from "@/lib/utils/badges"

type ProjectInfo = Pick<ProjectDetail, "id" | "name" | "members">

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

  // Owner change
  const [savingOwner, setSavingOwner] = useState(false)

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

  const handleOwnerChange = async (actorId: string) => {
    if (!task) return
    setSavingOwner(true)
    const ownerId = actorId === "none" ? null : actorId
    const res = await api.patch(`/api/projects/${projectId}/tasks/${taskId}`, { version: task.version, ownerId })
    if (res.success) {
      toast.success(ownerId ? "Owner assigned" : "Owner removed")
      refetch()
    } else {
      toast.error("Failed to update owner")
    }
    setSavingOwner(false)
  }

  const handleProgressSave = async () => {
    if (!task || progressValue === task.progress) return
    setSavingProgress(true)
    const res = await api.patch(`/api/projects/${projectId}/tasks/${taskId}`, {
      version: task.version,
      progress: progressValue,
    })
    if (res.success) {
      toast.success("Progress updated")
      setTask({ ...task, version: task.version + 1, progress: progressValue })
    } else {
      toast.error("Failed to update progress")
      setProgressValue(task.progress)
    }
    setSavingProgress(false)
  }

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
      <div className="grid gap-4 md:grid-cols-4">
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

      {/* Owner */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Task Owner</h2>
        {canManage && project ? (
          <div className="flex items-center gap-3">
            <Select
              value={task.ownerId ?? "none"}
              onValueChange={handleOwnerChange}
              disabled={savingOwner}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select owner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No owner</SelectItem>
                {project.members.map((m) => (
                  <SelectItem key={m.actorId} value={m.actorId}>
                    {m.actor.firstName} {m.actor.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {task.owner && task.owner.email && (
              <span className="text-sm text-muted-foreground">{task.owner.email}</span>
            )}
          </div>
        ) : task.owner ? (
          <p className="text-sm">
            {task.owner.firstName} {task.owner.lastName}
            {task.owner.id === actor?.id && (
              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
            )}
            {task.owner.email && (
              <span className="ml-2 text-muted-foreground">{task.owner.email}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No owner assigned.</p>
        )}
      </div>

      {/* Deliverables */}
      <Separator />
      <DeliverablesSection
        projectId={projectId}
        taskId={taskId}
        canManage={canManage}
        isTaskOwner={task.ownerId === actor?.id}
        currentActorId={actor?.id}
      />

      {/* Audit Log */}
      {canManage && (
        <>
          <Separator />
          <AuditLogSection
            apiUrl={`/api/projects/${projectId}/audit-log?taskId=${taskId}`}
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

    </div>
  )
}
