import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  HTTP_STATUS,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { saveFile, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from "@/lib/storage"

type Params = { projectId: string; taskId: string; deliverableId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId, taskId, deliverableId } = params!

  return withRLS(actor, async (db) => {
    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    const deliverable = await db.deliverable.findUnique({ where: { id: deliverableId } })
    if (!deliverable || deliverable.deletedAt || deliverable.taskId !== taskId) {
      return ApiErrors.notFound("Deliverable")
    }

    const attachments = await db.attachment.findMany({
      where: { deliverableId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return successResponse(attachments)
  })
})

export const POST = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, request: NextRequest, params, projectRole) => {
  const { projectId, taskId, deliverableId } = params!

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return ApiErrors.validationError("Expected multipart/form-data with a file")
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return ApiErrors.validationError("No file provided")
  }

  if (file.size > MAX_FILE_SIZE) {
    return ApiErrors.validationError(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB`)
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return ApiErrors.validationError(`File type "${file.type}" is not allowed`)
  }

  const result = await withRLS(actor, async (db) => {
    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    const deliverable = await db.deliverable.findUnique({ where: { id: deliverableId } })
    if (!deliverable || deliverable.deletedAt || deliverable.taskId !== taskId) {
      return ApiErrors.notFound("Deliverable")
    }

    // Check permission: MANAGER+ or task owner
    if (actor.systemRole !== "ADMIN" && projectRole !== "DIRECTOR" && projectRole !== "MANAGER") {
      if (task.ownerId !== actor.id) {
        return ApiErrors.forbidden("Requires MANAGER role or task owner access")
      }
    }

    // Save file to disk
    const stored = await saveFile(projectId, file)

    return db.attachment.create({
      data: {
        deliverableId,
        name: file.name,
        fileUrl: stored.storedName,
        fileType: stored.fileType,
        fileSize: stored.fileSize,
        uploadedById: actor.id,
      },
      select: {
        id: true,
        name: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "File uploaded", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
