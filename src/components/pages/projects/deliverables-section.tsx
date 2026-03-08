"use client"

import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/utils/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { DeliverableFormDialog } from "@/components/pages/projects/deliverable-form-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import type { DeliverableListItem, AttachmentItem } from "@/types"

interface DeliverablesSectionProps {
  projectId: string
  taskId: string
  canManage: boolean
  isTaskOwner: boolean
  currentActorId?: string
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function DeliverablesSection({
  projectId,
  taskId,
  canManage,
  isTaskOwner,
  currentActorId,
}: DeliverablesSectionProps) {
  const [deliverables, setDeliverables] = useState<DeliverableListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Expanded deliverable state — stores id + attachments
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editingDeliverable, setEditingDeliverable] = useState<DeliverableListItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingDeliverable, setDeletingDeliverable] = useState<DeliverableListItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Attachment delete
  const [deleteAttOpen, setDeleteAttOpen] = useState(false)
  const [deletingAttachment, setDeletingAttachment] = useState<{ attachment: AttachmentItem; deliverableId: string } | null>(null)
  const [deleteAttLoading, setDeleteAttLoading] = useState(false)

  // Upload
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadDeliverableIdRef = useRef<string | null>(null)

  const basePath = `/api/projects/${projectId}/tasks/${taskId}/deliverables`
  const canCreate = canManage || isTaskOwner

  // Fetch deliverables
  useEffect(() => {
    let cancelled = false
    const doFetch = async () => {
      const res = await api.get<DeliverableListItem[]>(basePath)
      if (cancelled) return
      if (res.success) {
        setDeliverables(res.data)
      }
      setIsLoading(false)
    }
    doFetch()
    return () => { cancelled = true }
  }, [basePath, fetchKey])

  const refetch = () => {
    setIsLoading(true)
    setFetchKey((k) => k + 1)
  }

  // Expand/collapse deliverable — fetch attachments on expand
  const toggleExpand = async (deliverableId: string) => {
    if (expandedId === deliverableId) {
      setExpandedId(null)
      return
    }
    setExpandedId(deliverableId)
    setAttachmentsLoading(true)
    const res = await api.get<AttachmentItem[]>(`${basePath}/${deliverableId}/attachments`)
    if (res.success) {
      setAttachments(res.data)
    }
    setAttachmentsLoading(false)
  }

  // Refresh attachments for current expanded deliverable
  const refreshAttachments = async (deliverableId: string) => {
    const res = await api.get<AttachmentItem[]>(`${basePath}/${deliverableId}/attachments`)
    if (res.success) {
      setAttachments(res.data)
    }
    // Also refresh deliverables to update _count
    refetch()
  }

  // Delete deliverable
  const handleDeleteDeliverable = async () => {
    if (!deletingDeliverable) return
    setDeleteLoading(true)
    const res = await api.delete(`${basePath}/${deletingDeliverable.id}`)
    if (res.success) {
      toast.success("Deliverable deleted")
      if (expandedId === deletingDeliverable.id) setExpandedId(null)
      refetch()
    } else {
      toast.error("Failed to delete deliverable")
    }
    setDeleteLoading(false)
    setDeleteOpen(false)
    setDeletingDeliverable(null)
  }

  // Upload attachment
  const handleUploadClick = (deliverableId: string) => {
    uploadDeliverableIdRef.current = deliverableId
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const deliverableId = uploadDeliverableIdRef.current
    if (!file || !deliverableId) return

    // Reset input so same file can be re-selected
    e.target.value = ""

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`${basePath}/${deliverableId}/attachments`, {
        method: "POST",
        body: formData,
      })

      const json = await res.json()
      if (json.success) {
        toast.success("File uploaded")
        await refreshAttachments(deliverableId)
      } else {
        toast.error(json.error?.message ?? "Upload failed")
      }
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  // Download attachment
  const handleDownload = (deliverableId: string, attachmentId: string) => {
    window.open(`${basePath}/${deliverableId}/attachments/${attachmentId}`, "_blank")
  }

  // Delete attachment
  const handleDeleteAttachment = async () => {
    if (!deletingAttachment) return
    setDeleteAttLoading(true)
    const { attachment, deliverableId } = deletingAttachment
    const res = await api.delete(`${basePath}/${deliverableId}/attachments/${attachment.id}`)
    if (res.success) {
      toast.success("Attachment deleted")
      await refreshAttachments(deliverableId)
    } else {
      toast.error("Failed to delete attachment")
    }
    setDeleteAttLoading(false)
    setDeleteAttOpen(false)
    setDeletingAttachment(null)
  }

  // Permission helpers
  const canEditDeliverable = (d: DeliverableListItem) =>
    canManage || d.createdById === currentActorId

  const canDeleteAttachment = (att: AttachmentItem) =>
    canManage || att.uploadedBy?.id === currentActorId

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Deliverables</h2>
        {canCreate && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setEditingDeliverable(null); setFormOpen(true) }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Deliverable
          </Button>
        )}
      </div>

      {deliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No deliverables yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliverables.map((d) => {
            const isExpanded = expandedId === d.id
            return (
              <Collapsible key={d.id} open={isExpanded}>
                <div className="rounded-md border">
                  <div className="flex items-center gap-3 p-3">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => toggleExpand(d.id)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{d.name}</span>
                        {d.type && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {d.type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{d.createdBy.firstName} {d.createdBy.lastName}</span>
                        <span>{timeAgo(d.createdAt)}</span>
                        <span className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" />
                          {d._count.attachments}
                        </span>
                      </div>
                    </div>

                    {canEditDeliverable(d) && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => { setEditingDeliverable(d); setFormOpen(true) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => { setDeletingDeliverable(d); setDeleteOpen(true) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <CollapsibleContent>
                    <div className="border-t px-3 py-3 bg-muted/30">
                      {attachmentsLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : (
                        <>
                          {attachments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No attachments</p>
                          ) : (
                            <div className="space-y-1.5">
                              {attachments.map((att) => (
                                <div
                                  key={att.id}
                                  className="flex items-center gap-3 rounded-md border bg-background p-2"
                                >
                                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium truncate block">{att.name}</span>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {att.fileSize != null && (
                                        <span>{formatFileSize(att.fileSize)}</span>
                                      )}
                                      {att.fileType && <span>{att.fileType}</span>}
                                      {att.uploadedBy && (
                                        <span>{att.uploadedBy.firstName} {att.uploadedBy.lastName}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleDownload(d.id, att.id)}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                    {canDeleteAttachment(att) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-destructive"
                                        onClick={() => {
                                          setDeletingAttachment({ attachment: att, deliverableId: d.id })
                                          setDeleteAttOpen(true)
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {canCreate && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              disabled={uploading}
                              onClick={() => handleUploadClick(d.id)}
                            >
                              <Upload className="mr-2 h-3.5 w-3.5" />
                              {uploading ? "Uploading..." : "Upload File"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Deliverable form dialog */}
      <DeliverableFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={refetch}
        projectId={projectId}
        taskId={taskId}
        deliverable={editingDeliverable ?? undefined}
      />

      {/* Delete deliverable dialog */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteDeliverable}
        title="Delete Deliverable"
        description={
          deletingDeliverable
            ? `Delete deliverable "${deletingDeliverable.name}"? This action cannot be undone.`
            : ""
        }
        isLoading={deleteLoading}
      />

      {/* Delete attachment dialog */}
      <DeleteConfirmDialog
        open={deleteAttOpen}
        onOpenChange={setDeleteAttOpen}
        onConfirm={handleDeleteAttachment}
        title="Delete Attachment"
        description={
          deletingAttachment
            ? `Delete file "${deletingAttachment.attachment.name}"? This action cannot be undone.`
            : ""
        }
        isLoading={deleteAttLoading}
      />
    </div>
  )
}
