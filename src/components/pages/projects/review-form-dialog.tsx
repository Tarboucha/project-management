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
import { createReviewSchema, updateReviewSchema } from "@/lib/validations/review"
import { api } from "@/lib/utils/api-client"
import { toast } from "sonner"

interface ReviewFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  projectId: string
  review?: {
    id: string
    version: number
    reviewDate: string
    notes: string
  }
}

export function ReviewFormDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  review,
}: ReviewFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!review

  useEffect(() => {
    if (!open) return
    setError(null)
  }, [open])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      reviewDate: formData.get("reviewDate") as string,
      notes: formData.get("notes") as string,
      ...(isEditing && { version: review!.version }),
    }

    const schema = isEditing ? updateReviewSchema : createReviewSchema
    const validation = schema.safeParse(data)
    if (!validation.success) {
      const msg = validation.error.issues[0].message
      setError(msg)
      toast.error(msg)
      return
    }

    setIsLoading(true)
    try {
      const basePath = `/api/projects/${projectId}/reviews`
      if (isEditing) {
        const res = await api.patch(`${basePath}/${review.id}`, validation.data)
        if (!res.success) throw new Error(res.error.message)
        toast.success("Review updated")
      } else {
        const res = await api.post(basePath, validation.data)
        if (!res.success) throw new Error(res.error.message)
        toast.success("Review created")
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

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Review" : "Add Review"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="reviewDate">Review Date *</Label>
            <Input
              id="reviewDate"
              name="reviewDate"
              type="date"
              defaultValue={review?.reviewDate?.slice(0, 10) ?? today}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes *</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={review?.notes ?? ""}
              rows={6}
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
                : isEditing ? "Save Changes" : "Add Review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
