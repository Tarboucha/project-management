"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth-store"
import { api } from "@/lib/utils/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { StateBadge } from "@/components/pages/shared/state-badge"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { ProjectFormDialog } from "@/components/pages/projects/project-form-dialog"
import { ProjectMembersSection } from "@/components/pages/projects/project-members-section"
import { TasksSection } from "@/components/pages/projects/tasks-section"
import { TodosSection } from "@/components/pages/projects/todos-section"
import { AuditLogSection } from "@/components/pages/shared/audit-log-section"
import { ArrowLeft, Check, FileDown, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { ProjectDetail } from "@/types"
import { formatDate } from "@/lib/utils/format"

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const actor = useAuthStore((s) => s.actor)
  const isInitialized = useAuthStore((s) => s.isInitialized)

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Dialogs
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Progress editing
  const [progressValue, setProgressValue] = useState<number>(0)
  const [savingProgress, setSavingProgress] = useState(false)

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const res = await api.get<ProjectDetail>(`/api/projects/${projectId}`)
      if (cancelled) return
      if (res.success) {
        setProject(res.data)
        setProgressValue(res.data.progress)
      } else {
        toast.error("Project not found")
        router.push("/projects")
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [projectId, router, fetchKey])

  const refetch = () => {
    setIsLoading(true)
    setFetchKey((k) => k + 1)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    const res = await api.delete(`/api/projects/${projectId}`)
    if (res.success) {
      toast.success("Project deleted")
      router.push("/projects")
    } else {
      toast.error("Failed to delete project")
    }
    setIsDeleting(false)
    setDeleteOpen(false)
  }

  const handleProgressSave = async () => {
    if (!project || progressValue === project.progress) return
    setSavingProgress(true)
    const res = await api.patch(`/api/projects/${projectId}`, {
      version: project.version,
      progress: progressValue,
    })
    if (res.success) {
      toast.success("Progress updated")
      setProject({ ...project, version: project.version + 1, progress: progressValue })
    } else {
      toast.error("Failed to update progress")
      setProgressValue(project.progress)
    }
    setSavingProgress(false)
  }

  // Determine the current user's project role
  const admin = actor?.systemRole === "ADMIN"
  const myMembership = project?.members.find((m) => m.actorId === actor?.id)
  const myProjectRole = myMembership?.role
  const canEdit = admin || myProjectRole === "DIRECTOR" || myProjectRole === "MANAGER"

  if (isLoading || !isInitialized) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!project) return null

  const tags = [
    project.category && { label: "Category", value: project.category.name },
    project.activity && { label: "Activity", value: project.activity.name },
    project.theme && { label: "Theme", value: project.theme.name },
  ].filter(Boolean) as Array<{ label: string; value: string }>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight"><span className="text-emerald-600">Project:</span> {project.name}</h1>
            <StateBadge state={project.state} />
          </div>
          <div className="ml-10 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Program:</span>
            <Link href={`/programs/${project.program.id}`} className="hover:underline">
              {project.program.name}
            </Link>
          </div>
          {project.objective && (
            <p className="text-muted-foreground ml-10">{project.objective}</p>
          )}
          {tags.length > 0 && (
            <div className="ml-10 flex flex-wrap gap-2 pt-1">
              {tags.map((tag) => (
                <Badge key={tag.label} variant="secondary">
                  {tag.label}: {tag.value}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/projects/${projectId}/report`)}
          >
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {admin && (
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

      {/* Project Info */}
      <div className="rounded-md border p-4 space-y-4">
        {/* Progress row */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-16 shrink-0">Progress</span>
            {canEdit ? (
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm font-semibold w-10">{progressValue}%</span>
                <Slider
                  value={[progressValue]}
                  onValueChange={([v]) => setProgressValue(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                {progressValue !== project.progress && (
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
            ) : (
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm font-semibold w-10">{project.progress}%</span>
                <Progress value={project.progress} className="h-2 flex-1" />
              </div>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6">
          <div>
            <div className="text-sm text-muted-foreground">Start Date</div>
            <div className="text-sm font-medium">{formatDate(project.startDate)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">End Date</div>
            <div className="text-sm font-medium">
              {project.endDate ? formatDate(project.endDate) : "—"}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Tasks</div>
            <div className="text-sm font-medium">{project._count.tasks}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Budget</div>
            <div className="text-sm font-medium">
              {project.budgetEstimated
                ? `${Number(project.budgetEstimated).toLocaleString()} EUR`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tasks Section */}
      <TasksSection projectId={projectId} projectRole={myProjectRole} />

      <Separator />

      {/* Members Section */}
      <ProjectMembersSection projectId={projectId} projectRole={myProjectRole} />

      <Separator />

      {/* Todos Section */}
      <TodosSection projectId={projectId} canManage={canEdit} members={project.members} />

      {/* Audit Log Section */}
      {canEdit && (
        <>
          <Separator />
          <AuditLogSection apiUrl={`/api/projects/${projectId}/audit-log`} />
        </>
      )}

      {/* Dialogs */}
      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={refetch}
        project={project}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        isLoading={isDeleting}
      />
    </div>
  )
}
