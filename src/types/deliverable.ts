import type { ActorSummary } from "./shared"

export interface DeliverableListItem {
  id: string
  name: string
  type?: string | null
  createdAt: string
  createdById: string
  createdBy: ActorSummary
  _count: { attachments: number }
}

export interface AttachmentItem {
  id: string
  name: string
  fileType?: string | null
  fileSize?: number | null
  createdAt: string
  uploadedBy?: ActorSummary | null
}

export interface DeliverableDetail extends DeliverableListItem {
  attachments: AttachmentItem[]
}
