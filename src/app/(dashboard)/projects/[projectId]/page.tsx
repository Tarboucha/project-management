"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth-store"
import { api } from "@/lib/utils/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { StateBadge } from "@/components/pages/shared/state-badge"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { ProjectFormDialog } from "@/components/pages/projects/project-form-dialog"
import { ProjectMembersSection } from "@/components/pages/projects/project-members-section"
import { MilestonesSection } from "@/components/pages/projects/milestones-section"
import { TasksSection } from "@/components/pages/projects/tasks-section"
import { AuditLogSection } from "@/components/pages/shared/audit-log-section"
import { ArrowLeft, FileDown, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface ProjectDetail {
  id: string
  name: string
  objective?: string | null
  state: "ACTIVE" | "ENDED"
  progress: number
  startDate: string
  endDate?: string | null
  budgetEstimated?: string | null
  createdAt: string
  program: { id: string; name: string }
  createdBy: { id: string; firstName: string; lastName: string }
  members: Array<{
    role: "DIRECTOR" | "MANAGER" | "CONTRIBUTOR"
    actorId: string
    actor: { id: string; firstName: string; lastName: string; email: string }
  }>
  _count: { tasks: number; milestones: number }
}

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

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const res = await api.get<ProjectDetail>(`/api/projects/${projectId}`)
      if (cancelled) return
      if (res.success) {
        setProject(res.data)
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString()
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
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
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

      {/* Project Info Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{project.progress}%</div>
            <Progress value={project.progress} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{formatDate(project.startDate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">End Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {project.endDate ? formatDate(project.endDate) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{project._count.tasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {project.budgetEstimated
                ? `${Number(project.budgetEstimated).toLocaleString()} EUR`
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Milestones Section */}
      <MilestonesSection projectId={projectId} projectRole={myProjectRole} />

      <Separator />

      {/* Tasks Section */}
      <TasksSection projectId={projectId} projectRole={myProjectRole} />

      <Separator />

      {/* Members Section */}
      <ProjectMembersSection projectId={projectId} projectRole={myProjectRole} />

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
