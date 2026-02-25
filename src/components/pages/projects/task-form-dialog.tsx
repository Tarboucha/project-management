"use client"

import { useEffect, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createTaskSchema, updateTaskSchema } from "@/lib/validations/task"
import { api } from "@/lib/utils/api-client"
import { toast } from "sonner"

interface Milestone {
  id: string
  name: string
}

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  projectId: string
  task?: {
    id: string
    objective: string
    details?: string | null
    milestoneId?: string | null
    priority: string
    startDate: string
    endDate?: string | null
    budgetEstimated?: number | string | null
  }
}

export function TaskFormDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  task,
}: TaskFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [selectedMilestone, setSelectedMilestone] = useState<string>(task?.milestoneId ?? "none")
  const [selectedPriority, setSelectedPriority] = useState<string>(task?.priority ?? "NORMAL")
  const isEditing = !!task

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const fetchMilestones = async () => {
      const res = await api.get<Milestone[]>(`/api/projects/${projectId}/milestones`)
      if (cancelled) return
      if (res.success) {
        setMilestones(res.data)
      }
    }

    fetchMilestones()

    // Reset selections when dialog opens
    setSelectedMilestone(task?.milestoneId ?? "none")
    setSelectedPriority(task?.priority ?? "NORMAL")
    setError(null)

    return () => { cancelled = true }
  }, [open, projectId, task])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      objective: formData.get("objective") as string,
      details: (formData.get("details") as string) || undefined,
      priority: selectedPriority,
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || undefined,
    }

    if (selectedMilestone && selectedMilestone !== "none") {
      data.milestoneId = selectedMilestone
    } else if (isEditing) {
      data.milestoneId = null
    }

    const budgetStr = formData.get("budgetEstimated") as string
    if (budgetStr) {
      data.budgetEstimated = parseFloat(budgetStr)
    }

    const schema = isEditing ? updateTaskSchema : createTaskSchema
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
          `/api/projects/${projectId}/tasks/${task.id}`,
          validation.data
        )
        if (!res.success) throw new Error(res.error.message)
        toast.success("Task updated")
      } else {
        const res = await api.post(
          `/api/projects/${projectId}/tasks`,
          validation.data
        )
        if (!res.success) throw new Error(res.error.message)
        toast.success("Task created")
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="objective">Objective *</Label>
            <Input
              id="objective"
              name="objective"
              defaultValue={task?.objective ?? ""}
              required
              maxLength={255}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="details">Details</Label>
            <Textarea
              id="details"
              name="details"
              defaultValue={task?.details ?? ""}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Milestone</Label>
              <Select value={selectedMilestone} onValueChange={setSelectedMilestone}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={formatDate(task?.startDate)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={formatDate(task?.endDate)}
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
              defaultValue={task?.budgetEstimated?.toString() ?? ""}
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
                : isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
