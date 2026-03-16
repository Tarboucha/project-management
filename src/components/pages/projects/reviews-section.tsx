"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/utils/api-client"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { ReviewFormDialog } from "@/components/pages/projects/review-form-dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils/format"
import type { ReviewItem } from "@/types/review"

interface ReviewsSectionProps {
  projectId: string
  projectRole?: "DIRECTOR" | "MANAGER" | "CONTRIBUTOR"
}

export function ReviewsSection({ projectId, projectRole }: ReviewsSectionProps) {
  const { isAdmin } = useAuthStore()
  const admin = isAdmin()

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingReview, setDeletingReview] = useState<ReviewItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Expanded notes
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const canManage = admin || projectRole === "DIRECTOR" || projectRole === "MANAGER"

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const res = await api.get<ReviewItem[]>(
        `/api/projects/${projectId}/reviews`
      )
      if (cancelled) return
      if (res.success) {
        setReviews(res.data)
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [projectId, fetchKey])

  const refetch = () => {
    setIsLoading(true)
    setFetchKey((k) => k + 1)
  }

  const handleDelete = async () => {
    if (!deletingReview) return
    setDeleteLoading(true)
    const res = await api.delete(`/api/projects/${projectId}/reviews/${deletingReview.id}`)
    if (res.success) {
      toast.success("Review deleted")
      refetch()
    } else {
      toast.error("Failed to delete review")
    }
    setDeleteLoading(false)
    setDeleteOpen(false)
    setDeletingReview(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reviews ({reviews.length})</h2>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditingReview(null)
              setFormOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Review
          </Button>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[150px]">Created By</TableHead>
                {canManage && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(review.reviewDate)}
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-left cursor-pointer hover:opacity-70"
                      onClick={() =>
                        setExpandedId(expandedId === review.id ? null : review.id)
                      }
                    >
                      {expandedId === review.id ? (
                        <span className="whitespace-pre-wrap">{review.notes}</span>
                      ) : (
                        <span className="line-clamp-2">{review.notes}</span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {review.createdBy.firstName} {review.createdBy.lastName}
                    </span>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingReview(review)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setDeletingReview(review)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ReviewFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={refetch}
        projectId={projectId}
        review={editingReview ?? undefined}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Review"
        description={
          deletingReview
            ? `Delete review from ${formatDate(deletingReview.reviewDate)}? This action cannot be undone.`
            : ""
        }
        isLoading={deleteLoading}
      />
    </div>
  )
}
