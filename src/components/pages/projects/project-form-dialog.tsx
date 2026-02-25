"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createProjectSchema, updateProjectSchema } from "@/lib/validations/project"
import { api } from "@/lib/utils/api-client"
import { toast } from "sonner"

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  programId?: string
  project?: {
    id: string
    name: string
    objective?: string | null
    startDate: string
    endDate?: string | null
    budgetEstimated?: number | string | null
  }
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  onSuccess,
  programId,
  project,
}: ProjectFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!project

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      name: formData.get("name") as string,
      objective: (formData.get("objective") as string) || undefined,
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || undefined,
    }

    const budgetStr = formData.get("budgetEstimated") as string
    if (budgetStr) {
      data.budgetEstimated = parseFloat(budgetStr)
    }

    if (!isEditing && programId) {
      data.programId = programId
    }

    const schema = isEditing ? updateProjectSchema : createProjectSchema
    const validation = schema.safeParse(data)
    if (!validation.success) {
      const msg = validation.error.issues[0].message
      setError(msg)
      toast.error(msg)
      return
    }

    setIsLoading(true)
    try {
      if (isEditing) {
        const res = await api.patch(`/api/projects/${project.id}`, validation.data)
        if (!res.success) {
          throw new Error(res.error.message)
        }
        toast.success("Project updated")
      } else {
        const res = await api.post(
          `/api/programs/${programId}/projects`,
          validation.data
        )
        if (!res.success) {
          throw new Error(res.error.message)
        }
        toast.success("Project created")
      }
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return ""
    return dateStr.slice(0, 10)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Project" : "Create Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={project?.name ?? ""}
              required
              maxLength={255}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="objective">Objective</Label>
            <Textarea
              id="objective"
              name="objective"
              defaultValue={project?.objective ?? ""}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={formatDate(project?.startDate)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={formatDate(project?.endDate)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="budgetEstimated">Budget</Label>
            <Input
              id="budgetEstimated"
              name="budgetEstimated"
              type="number"
              step="0.01"
              min="0"
              defaultValue={project?.budgetEstimated?.toString() ?? ""}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? isEditing ? "Saving..." : "Creating..."
                : isEditing ? "Save Changes" : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
