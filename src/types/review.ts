import type { ActorSummary } from "./shared"

export interface ReviewItem {
  id: string
  reviewDate: string
  notes: string
  createdBy: ActorSummary
  createdAt: string
  version: number
}
