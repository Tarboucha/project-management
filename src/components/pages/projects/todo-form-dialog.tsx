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
import { DatePicker } from "@/components/ui/date-picker"
import { createTodoSchema, updateTodoSchema } from "@/lib/validations/todo"
import { api } from "@/lib/utils/api-client"
import { toast } from "sonner"
import type { ActorSummary } from "@/types"

interface TodoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  projectId: string
  members: Array<{ actorId: string; actor: ActorSummary }>
  todo?: {
    id: string
    version: number
    action: string
    status: string
    todoOrder: number
    deliveryDate?: string | null
    responsibleId?: string | null
    comments?: string | null
  }
}

export function TodoFormDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  members,
  todo,
}: TodoFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [responsibleId, setResponsibleId] = useState<string>(todo?.responsibleId ?? "none")
  const [status, setStatus] = useState<string>(todo?.status ?? "ACTIVE")
  const isEditing = !!todo

  useEffect(() => {
    if (!open) return
    setResponsibleId(todo?.responsibleId ?? "none")
    setStatus(todo?.status ?? "ACTIVE")
    setError(null)
  }, [open, todo])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const orderStr = formData.get("todoOrder") as string
    const data: Record<string, unknown> = {
      action: formData.get("action") as string,
      todoOrder: orderStr ? parseInt(orderStr, 10) : 0,
      status,
      deliveryDate: (formData.get("deliveryDate") as string) || undefined,
      responsibleId: responsibleId === "none" ? null : responsibleId,
      comments: (formData.get("comments") as string) || undefined,
      ...(isEditing && { version: todo!.version }),
    }

    const schema = isEditing ? updateTodoSchema : createTodoSchema
    const validation = schema.safeParse(data)
    if (!validation.success) {
      const msg = validation.error.issues[0].message
      setError(msg)
      toast.error(msg)
      return
    }

    setIsLoading(true)
    try {
      const basePath = `/api/projects/${projectId}/todos`
      if (isEditing) {
        const res = await api.patch(`${basePath}/${todo.id}`, validation.data)
        if (!res.success) throw new Error(res.error.message)
        toast.success("Todo updated")
      } else {
        const res = await api.post(basePath, validation.data)
        if (!res.success) throw new Error(res.error.message)
        toast.success("Todo created")
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Todo" : "Add Todo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_80px] gap-4">
            <div className="grid gap-2">
              <Label htmlFor="action">Action *</Label>
              <Input
                id="action"
                name="action"
                defaultValue={todo?.action ?? ""}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="todoOrder">Order</Label>
              <Input
                id="todoOrder"
                name="todoOrder"
                type="number"
                min="0"
                step="1"
                defaultValue={todo?.todoOrder?.toString() ?? "0"}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Delivery Date</Label>
            <DatePicker
              name="deliveryDate"
              defaultValue={todo?.deliveryDate?.slice(0, 10)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label>Responsible</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select responsible..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No one</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.actorId} value={m.actorId}>
                    {m.actor.firstName} {m.actor.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              name="comments"
              defaultValue={todo?.comments ?? ""}
              rows={3}
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
                : isEditing ? "Save Changes" : "Add Todo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
