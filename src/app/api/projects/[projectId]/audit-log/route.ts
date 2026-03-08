import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  handleUnsupportedMethod,
  parseCursorPagination,
  cursorPaginatedResponse,
  parseFilters,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { enrichAuditEntries } from "@/lib/utils/audit"
import type { Prisma, AuditAction } from "@/generated/prisma/client"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["tableName", "recordId", "action", "taskId"])

  return withRLS(actor, async (db) => {
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project || project.deletedAt) {
      return ApiErrors.notFound("Project")
    }

    let where: Prisma.AuditLogWhereInput

    if (filters.taskId) {
      // Task-scoped: everything related to a specific task
      where = {
        taskId: filters.taskId,
        ...(filters.tableName && { tableName: filters.tableName }),
        ...(filters.action && { action: filters.action as AuditAction }),
      }
    } else if (filters.recordId) {
      // Single entity history mode (used by History dialog)
      where = {
        recordId: filters.recordId,
        ...(filters.tableName && { tableName: filters.tableName }),
        ...(filters.action && { action: filters.action as AuditAction }),
      }
    } else {
      // Full project scope
      where = {
        projectId,
        ...(filters.tableName && { tableName: filters.tableName }),
        ...(filters.action && { action: filters.action as AuditAction }),
      }
    }

    const logs = await db.auditLog.findMany({
      where,
      take: pagination.limit + 1,
      ...(pagination.cursor && {
        cursor: { id: pagination.cursor },
        skip: 1,
      }),
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    await enrichAuditEntries(logs)

    return cursorPaginatedResponse(logs, pagination)
  })
})

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
