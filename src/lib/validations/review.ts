import { z } from "zod"

export const createReviewSchema = z.object({
  reviewDate: z.string().min(1, "Review date is required"),
  notes: z.string().min(1, "Notes are required").max(5000),
})

export const updateReviewSchema = z.object({
  version: z.number().int().positive(),
  reviewDate: z.string().min(1).optional(),
  notes: z.string().min(1).max(5000).optional(),
})
