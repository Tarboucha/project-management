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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createDeliverableSchema, updateDeliverableSchema } from "@/lib/validations/deliverable"
import { api } from "@/lib/utils/api-client"
import { toast } from "sonner"

interface DeliverableFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  projectId: string
  taskId: string
  deliverable?: {
    id: string
    name: string
    type?: string | null
  }
}

const DELIVERABLE_TYPES = ["DOCUMENT", "REPORT", "DESIGN", "CODE", "OTHER"] as const

export function DeliverableFormDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  taskId,
  deliverable,
}: DeliverableFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string>(deliverable?.type ?? "")
  const isEditing = !!deliverable

  useEffect(() => {
    if (!open) return
    setSelectedType(deliverable?.type ?? "")
    setError(null)
  }, [open, deliverable])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      name: formData.get("name") as string,
      type: selectedType || undefined,
    }

    const schema = isEditing ? updateDeliverableSchema : createDeliverableSchema
    const validation = schema.safeParse(data)
    if (!validation.success) {
      const msg = validation.error.issues[0].message
      setError(msg)
      toast.error(msg)
      return
    }

    setIsLoading(true)
    try {
      const basePath = `/api/projects/${projectId}/tasks/${taskId}/deliverables`
      if (isEditing) {
        const res = await api.patch(`${basePath}/${deliverable.id}`, validation.data)
        if (!res.success) throw new Error(res.error.message)
        toast.success("Deliverable updated")
      } else {
        const res = await api.post(basePath, validation.data)
        if (!res.success) throw new Error(res.error.message)
        toast.success("Deliverable created")
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
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Deliverable" : "Add Deliverable"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={deliverable?.name ?? ""}
              required
              maxLength={255}
            />
          </div>

          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {DELIVERABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                : isEditing ? "Save Changes" : "Add Deliverable"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
