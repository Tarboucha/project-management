import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { auditLog } from "@/lib/utils/audit"

type Params = { projectId: string; taskId: string; actorId: string }

export const DELETE = withAdminOrProjectRole<Params>("MANAGER", async (currentActor, _request: NextRequest, params) => {
  const { projectId, taskId, actorId } = params!

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.deletedAt || task.projectId !== projectId) {
    return ApiErrors.notFound("Task")
  }

  const existing = await prisma.taskContributor.findUnique({
    where: { taskId_actorId: { taskId, actorId } },
  })
  if (!existing) {
    return ApiErrors.notFound("Contributor")
  }

  await prisma.taskContributor.delete({
    where: { taskId_actorId: { taskId, actorId } },
  })

  await auditLog({ entityType: "TaskContributor", entityId: actorId, action: "DELETE", actorId: currentActor.id, oldData: existing })

  return successResponse(null, "Contributor removed")
})

export async function GET() { return handleUnsupportedMethod(["DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["DELETE"]) }
export async function PUT() { return handleUnsupportedMethod(["DELETE"]) }
export async function PATCH() { return handleUnsupportedMethod(["DELETE"]) }
