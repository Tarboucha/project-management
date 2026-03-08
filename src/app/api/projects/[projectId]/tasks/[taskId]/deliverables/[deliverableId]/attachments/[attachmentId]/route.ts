import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { getFilePath, fileExists, deleteFile } from "@/lib/storage"

type Params = { projectId: string; taskId: string; deliverableId: string; attachmentId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId, taskId, deliverableId, attachmentId } = params!

  const attachment = await withRLS(actor, async (db) => {
    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    const deliverable = await db.deliverable.findUnique({ where: { id: deliverableId } })
    if (!deliverable || deliverable.deletedAt || deliverable.taskId !== taskId) {
      return ApiErrors.notFound("Deliverable")
    }

    const att = await db.attachment.findUnique({ where: { id: attachmentId } })
    if (!att || att.deliverableId !== deliverableId) {
      return ApiErrors.notFound("Attachment")
    }

    return att
  })

  if (attachment instanceof Response) {
    return attachment
  }

  if (!attachment.fileUrl) {
    return ApiErrors.notFound("File")
  }

  const exists = await fileExists(projectId, attachment.fileUrl)
  if (!exists) {
    return ApiErrors.notFound("File not found on disk")
  }

  const filePath = getFilePath(projectId, attachment.fileUrl)
  const buffer = await readFile(filePath)

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": attachment.fileType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.name)}"`,
      "Content-Length": String(buffer.length),
    },
  })
})

export const DELETE = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params, projectRole) => {
  const { projectId, taskId, deliverableId, attachmentId } = params!

  const result = await withRLS(actor, async (db) => {
    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    const deliverable = await db.deliverable.findUnique({ where: { id: deliverableId } })
    if (!deliverable || deliverable.deletedAt || deliverable.taskId !== taskId) {
      return ApiErrors.notFound("Deliverable")
    }

    const att = await db.attachment.findUnique({ where: { id: attachmentId } })
    if (!att || att.deliverableId !== deliverableId) {
      return ApiErrors.notFound("Attachment")
    }

    // Check permission: MANAGER+ or uploader
    if (actor.systemRole !== "ADMIN" && projectRole !== "DIRECTOR" && projectRole !== "MANAGER") {
      if (att.uploadedById !== actor.id) {
        return ApiErrors.forbidden("Requires MANAGER role or upload ownership")
      }
    }

    // Delete from DB
    await db.attachment.delete({ where: { id: attachmentId } })

    return att
  })

  if (result instanceof Response) {
    return result
  }

  // Delete file from disk (outside transaction)
  if (result.fileUrl) {
    await deleteFile(projectId, result.fileUrl)
  }

  return successResponse(null, "Attachment deleted")
})

export async function PUT() { return handleUnsupportedMethod(["GET", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "DELETE"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "DELETE"]) }
