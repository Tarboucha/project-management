import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  handleUnsupportedMethod,
  parseCursorPagination,
  cursorPaginatedResponse,
  parseFilters,
} from "@/lib/utils/api-response"
import { withAdmin } from "@/lib/utils/api-route-helper"
import { enrichAuditEntries } from "@/lib/utils/audit"
import type { Prisma, AuditAction } from "@/generated/prisma/client"

export const GET = withAdmin(async (actor, request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["tableName", "action"])

  const where: Prisma.AuditLogWhereInput = {
    ...(filters.tableName && { tableName: filters.tableName }),
    ...(filters.action && { action: filters.action as AuditAction }),
  }

  return withRLS(actor, async (db) => {
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
