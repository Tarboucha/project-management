"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth-store"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { ProgramFormDialog } from "@/components/pages/programs/program-form-dialog"
import { ProjectFormDialog } from "@/components/pages/projects/project-form-dialog"
import { AuditLogSection } from "@/components/pages/shared/audit-log-section"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Plus, Pencil, Trash2, Briefcase } from "lucide-react"
import { toast } from "sonner"
import type { Program } from "@/types"
import type { ProjectListItem as Project } from "@/types"
import { formatDate } from "@/lib/utils/format"


export default function ProgramDetailPage() {
  const { programId } = useParams<{ programId: string }>()
  const router = useRouter()
  const { isAdmin, isInitialized } = useAuthStore()

  const [program, setProgram] = useState<Program | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Dialogs
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const res = await api.get<Program>(`/api/programs/${programId}`)
      if (cancelled) return
      if (res.success) {
        setProgram(res.data)
      } else {
        toast.error("Program not found")
        router.push("/programs")
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [programId, router, fetchKey])

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const res = await api.get(
        `/api/programs/${programId}/projects?limit=50`
      )
      if (cancelled) return
      if (res.success) {
        const paginated = res as CursorPaginatedResult<Project>
        setProjects(paginated.data)
      }
      setProjectsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [programId, fetchKey])

  const refetch = () => {
    setIsLoading(true)
    setProjectsLoading(true)
    setFetchKey((k) => k + 1)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    const res = await api.delete(`/api/programs/${programId}`)
    if (res.success) {
      toast.success("Program deleted")
      router.push("/programs")
    } else {
      toast.error("Failed to delete program")
    }
    setIsDeleting(false)
    setDeleteOpen(false)
  }

  if (isLoading || !isInitialized) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!program) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/programs">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
            <StateBadge state={program.state} />
          </div>
          {program.description && (
            <p className="text-muted-foreground ml-10">{program.description}</p>
          )}
        </div>
        {isAdmin() && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Program Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{formatDate(program.startDate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">End Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {program.endDate ? formatDate(program.endDate) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {program.budgetEstimated
                ? `${Number(program.budgetEstimated).toLocaleString()} ${program.currency ?? "EUR"}`
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{program._count.projects}</div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          {isAdmin() && (
            <Button size="sm" onClick={() => setProjectFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          )}
        </div>

        {projectsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <Briefcase className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 text-base font-medium">No projects yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the first project under this program
            </p>
            {isAdmin() && (
              <Button className="mt-3" size="sm" onClick={() => setProjectFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StateBadge state={project.state} />
                    </TableCell>
                    <TableCell>{project.progress}%</TableCell>
                    <TableCell>{formatDate(project.startDate)}</TableCell>
                    <TableCell>{project._count.members}</TableCell>
                    <TableCell>{project._count.tasks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Audit Log Section */}
      {isAdmin() && (
        <>
          <Separator />
          <AuditLogSection apiUrl={`/api/programs/${programId}/audit-log`} />
        </>
      )}

      {/* Dialogs */}
      <ProgramFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={refetch}
        program={program}
      />

      <ProjectFormDialog
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        onSuccess={refetch}
        programId={programId}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Program"
        description="Are you sure you want to delete this program? All projects under it will still exist but won't be linked to a program."
        isLoading={isDeleting}
      />
    </div>
  )
}
