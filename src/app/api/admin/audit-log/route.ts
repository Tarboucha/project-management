import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  handleUnsupportedMethod,
  parseCursorPagination,
  cursorPaginatedResponse,
  parseFilters,
} from "@/lib/utils/api-response"
import { withAdmin } from "@/lib/utils/api-route-helper"
import { enrichAuditEntries } from "@/lib/utils/audit"
import type { Prisma, AuditAction } from "@/generated/prisma/client"

export const GET = withAdmin(async (_actor, request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["entityType", "action"])

  const where: Prisma.AuditLogWhereInput = {
    ...(filters.entityType && { entityType: filters.entityType }),
    ...(filters.action && { action: filters.action as AuditAction }),
  }

  const logs = await prisma.auditLog.findMany({
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

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
