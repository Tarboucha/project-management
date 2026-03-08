import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  handleUnsupportedMethod,
  parseCursorPagination,
  cursorPaginatedResponse,
  parseFilters,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdmin } from "@/lib/utils/api-route-helper"
import { enrichAuditEntries } from "@/lib/utils/audit"
import type { Prisma, AuditAction } from "@/generated/prisma/client"

type Params = { programId: string }

export const GET = withAdmin<Params>(async (actor, request: NextRequest, params) => {
  const { programId } = params!

  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["action"])

  return withRLS(actor, async (db) => {
    const program = await db.program.findUnique({ where: { id: programId } })
    if (!program || program.deletedAt) {
      return ApiErrors.notFound("Program")
    }

    const where: Prisma.AuditLogWhereInput = {
      tableName: "program",
      recordId: programId,
      ...(filters.action && { action: filters.action as AuditAction }),
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
