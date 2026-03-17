"use client"

import { useEffect, useReducer, useRef } from "react"
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

// ── State & Actions ──────────────────────────────────────────

interface DeliverablesState {
  deliverables: DeliverableListItem[]
  isLoading: boolean
  fetchKey: number
  // Expanded
  expandedId: string | null
  attachments: AttachmentItem[]
  attachmentsLoading: boolean
  // Dialogs
  formOpen: boolean
  editingDeliverable: DeliverableListItem | null
  deleteOpen: boolean
  deletingDeliverable: DeliverableListItem | null
  deleteLoading: boolean
  // Attachment delete
  deleteAttOpen: boolean
  deletingAttachment: { attachment: AttachmentItem; deliverableId: string } | null
  deleteAttLoading: boolean
  // Upload
  uploading: boolean
}

type DeliverablesAction =
  | { type: "SET_DELIVERABLES"; deliverables: DeliverableListItem[] }
  | { type: "REFETCH" }
  | { type: "EXPAND"; id: string }
  | { type: "COLLAPSE" }
  | { type: "SET_ATTACHMENTS"; attachments: AttachmentItem[] }
  | { type: "SET_ATTACHMENTS_LOADING"; value: boolean }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; deliverable: DeliverableListItem }
  | { type: "CLOSE_FORM" }
  | { type: "OPEN_DELETE"; deliverable: DeliverableListItem }
  | { type: "CLOSE_DELETE" }
  | { type: "SET_DELETE_LOADING"; value: boolean }
  | { type: "OPEN_DELETE_ATT"; attachment: AttachmentItem; deliverableId: string }
  | { type: "CLOSE_DELETE_ATT" }
  | { type: "SET_DELETE_ATT_LOADING"; value: boolean }
  | { type: "SET_UPLOADING"; value: boolean }

const initialState: DeliverablesState = {
  deliverables: [],
  isLoading: true,
  fetchKey: 0,
  expandedId: null,
  attachments: [],
  attachmentsLoading: false,
  formOpen: false,
  editingDeliverable: null,
  deleteOpen: false,
  deletingDeliverable: null,
  deleteLoading: false,
  deleteAttOpen: false,
  deletingAttachment: null,
  deleteAttLoading: false,
  uploading: false,
}

function reducer(state: DeliverablesState, action: DeliverablesAction): DeliverablesState {
  switch (action.type) {
    case "SET_DELIVERABLES":
      return { ...state, deliverables: action.deliverables, isLoading: false }
    case "REFETCH":
      return { ...state, isLoading: true, fetchKey: state.fetchKey + 1 }
    case "EXPAND":
      return { ...state, expandedId: action.id, attachmentsLoading: true }
    case "COLLAPSE":
      return { ...state, expandedId: null }
    case "SET_ATTACHMENTS":
      return { ...state, attachments: action.attachments, attachmentsLoading: false }
    case "SET_ATTACHMENTS_LOADING":
      return { ...state, attachmentsLoading: action.value }
    case "OPEN_CREATE":
      return { ...state, formOpen: true, editingDeliverable: null }
    case "OPEN_EDIT":
      return { ...state, formOpen: true, editingDeliverable: action.deliverable }
    case "CLOSE_FORM":
      return { ...state, formOpen: false, editingDeliverable: null }
    case "OPEN_DELETE":
      return { ...state, deleteOpen: true, deletingDeliverable: action.deliverable }
    case "CLOSE_DELETE":
      return { ...state, deleteOpen: false, deletingDeliverable: null, deleteLoading: false }
    case "SET_DELETE_LOADING":
      return { ...state, deleteLoading: action.value }
    case "OPEN_DELETE_ATT":
      return { ...state, deleteAttOpen: true, deletingAttachment: { attachment: action.attachment, deliverableId: action.deliverableId } }
    case "CLOSE_DELETE_ATT":
      return { ...state, deleteAttOpen: false, deletingAttachment: null, deleteAttLoading: false }
    case "SET_DELETE_ATT_LOADING":
      return { ...state, deleteAttLoading: action.value }
    case "SET_UPLOADING":
      return { ...state, uploading: action.value }
  }
}

// ── Component ────────────────────────────────────────────────

export function DeliverablesSection({
  projectId,
  taskId,
  canManage,
  isTaskOwner,
  currentActorId,
}: DeliverablesSectionProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
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
        dispatch({ type: "SET_DELIVERABLES", deliverables: res.data })
      }
    }
    doFetch()
    return () => { cancelled = true }
  }, [basePath, state.fetchKey])

  const refetch = () => dispatch({ type: "REFETCH" })

  // Expand/collapse deliverable — fetch attachments on expand
  const toggleExpand = async (deliverableId: string) => {
    if (state.expandedId === deliverableId) {
      dispatch({ type: "COLLAPSE" })
      return
    }
    dispatch({ type: "EXPAND", id: deliverableId })
    const res = await api.get<AttachmentItem[]>(`${basePath}/${deliverableId}/attachments`)
    if (res.success) {
      dispatch({ type: "SET_ATTACHMENTS", attachments: res.data })
    } else {
      dispatch({ type: "SET_ATTACHMENTS_LOADING", value: false })
    }
  }

  // Refresh attachments for current expanded deliverable
  const refreshAttachments = async (deliverableId: string) => {
    const res = await api.get<AttachmentItem[]>(`${basePath}/${deliverableId}/attachments`)
    if (res.success) {
      dispatch({ type: "SET_ATTACHMENTS", attachments: res.data })
    }
    refetch()
  }

  // Delete deliverable
  const handleDeleteDeliverable = async () => {
    if (!state.deletingDeliverable) return
    dispatch({ type: "SET_DELETE_LOADING", value: true })
    const res = await api.delete(`${basePath}/${state.deletingDeliverable.id}`)
    if (res.success) {
      toast.success("Deliverable deleted")
      if (state.expandedId === state.deletingDeliverable.id) dispatch({ type: "COLLAPSE" })
      refetch()
    } else {
      toast.error("Failed to delete deliverable")
    }
    dispatch({ type: "CLOSE_DELETE" })
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

    e.target.value = ""
    dispatch({ type: "SET_UPLOADING", value: true })
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
      dispatch({ type: "SET_UPLOADING", value: false })
    }
  }

  // Download attachment
  const handleDownload = (deliverableId: string, attachmentId: string) => {
    window.open(`${basePath}/${deliverableId}/attachments/${attachmentId}`, "_blank")
  }

  // Delete attachment
  const handleDeleteAttachment = async () => {
    if (!state.deletingAttachment) return
    dispatch({ type: "SET_DELETE_ATT_LOADING", value: true })
    const { attachment, deliverableId } = state.deletingAttachment
    const res = await api.delete(`${basePath}/${deliverableId}/attachments/${attachment.id}`)
    if (res.success) {
      toast.success("Attachment deleted")
      await refreshAttachments(deliverableId)
    } else {
      toast.error("Failed to delete attachment")
    }
    dispatch({ type: "CLOSE_DELETE_ATT" })
  }

  // Permission helpers
  const canEditDeliverable = (d: DeliverableListItem) =>
    canManage || d.createdById === currentActorId

  const canDeleteAttachment = (att: AttachmentItem) =>
    canManage || att.uploadedBy?.id === currentActorId

  if (state.isLoading) {
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
            onClick={() => dispatch({ type: "OPEN_CREATE" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Deliverable
          </Button>
        )}
      </div>

      {state.deliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No deliverables yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {state.deliverables.map((d) => {
            const isExpanded = state.expandedId === d.id
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
                          onClick={() => dispatch({ type: "OPEN_EDIT", deliverable: d })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => dispatch({ type: "OPEN_DELETE", deliverable: d })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <CollapsibleContent>
                    <div className="border-t px-3 py-3 bg-muted/30">
                      {state.attachmentsLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : (
                        <>
                          {state.attachments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No attachments</p>
                          ) : (
                            <div className="space-y-1.5">
                              {state.attachments.map((att) => (
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
                                        onClick={() => dispatch({ type: "OPEN_DELETE_ATT", attachment: att, deliverableId: d.id })}
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
                              disabled={state.uploading}
                              onClick={() => handleUploadClick(d.id)}
                            >
                              <Upload className="mr-2 h-3.5 w-3.5" />
                              {state.uploading ? "Uploading..." : "Upload File"}
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
        open={state.formOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_FORM" })}
        onSuccess={refetch}
        projectId={projectId}
        taskId={taskId}
        deliverable={state.editingDeliverable ?? undefined}
      />

      {/* Delete deliverable dialog */}
      <DeleteConfirmDialog
        open={state.deleteOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_DELETE" })}
        onConfirm={handleDeleteDeliverable}
        title="Delete Deliverable"
        description={
          state.deletingDeliverable
            ? `Delete deliverable "${state.deletingDeliverable.name}"? This action cannot be undone.`
            : ""
        }
        isLoading={state.deleteLoading}
      />

      {/* Delete attachment dialog */}
      <DeleteConfirmDialog
        open={state.deleteAttOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_DELETE_ATT" })}
        onConfirm={handleDeleteAttachment}
        title="Delete Attachment"
        description={
          state.deletingAttachment
            ? `Delete file "${state.deletingAttachment.attachment.name}"? This action cannot be undone.`
            : ""
        }
        isLoading={state.deleteAttLoading}
      />
    </div>
  )
}
