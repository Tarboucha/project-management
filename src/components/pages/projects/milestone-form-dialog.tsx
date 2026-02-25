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
import { createMilestoneSchema, updateMilestoneSchema } from "@/lib/validations/milestone"
import { api } from "@/lib/utils/api-client"
import { toast } from "sonner"

interface MilestoneFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  projectId: string
  milestone?: {
    id: string
    name: string
    description?: string | null
    dueDate: string
  }
}

export function MilestoneFormDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  milestone,
}: MilestoneFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!milestone

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      dueDate: formData.get("dueDate") as string,
    }

    const schema = isEditing ? updateMilestoneSchema : createMilestoneSchema
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
        const res = await api.patch(
          `/api/projects/${projectId}/milestones/${milestone.id}`,
          validation.data
        )
        if (!res.success) throw new Error(res.error.message)
        toast.success("Milestone updated")
      } else {
        const res = await api.post(
          `/api/projects/${projectId}/milestones`,
          validation.data
        )
        if (!res.success) throw new Error(res.error.message)
        toast.success("Milestone created")
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
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Milestone" : "Create Milestone"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={milestone?.name ?? ""}
              required
              maxLength={255}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={milestone?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dueDate">Due Date *</Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={formatDate(milestone?.dueDate)}
              required
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
                : isEditing ? "Save Changes" : "Create Milestone"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
