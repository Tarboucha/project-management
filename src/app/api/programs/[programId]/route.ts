import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAnyAuth, withAdmin } from "@/lib/utils/api-route-helper"
import { updateProgramSchema } from "@/lib/validations/program"

type Params = { programId: string }

export const GET = withAnyAuth<Params>(async (actor, _request: NextRequest, params) => {
  const { programId } = params!

  return withRLS(actor, async (db) => {
    const program = await db.program.findUnique({
      where: { id: programId },
      include: {
        _count: { select: { projects: { where: { deletedAt: null } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    if (!program || program.deletedAt) {
      return ApiErrors.notFound("Program")
    }

    // Non-admin: verify actor has membership in at least one project under this program
    if (actor.systemRole !== "ADMIN") {
      const membership = await db.projectMember.findFirst({
        where: {
          actorId: actor.id,
          deletedAt: null,
          project: { programId, deletedAt: null },
        },
      })
      if (!membership) {
        return ApiErrors.notFound("Program")
      }
    }

    return successResponse(program)
  })
})

export const PATCH = withAdmin<Params>(async (actor, request: NextRequest, params) => {
  const { programId } = params!

  const body = await request.json()
  const validation = updateProgramSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const program = await withRLS(actor, async (db) => {
    const existing = await db.program.findUnique({ where: { id: programId } })
    if (!existing || existing.deletedAt) {
      return null
    }

    const updateData: Record<string, unknown> = {
      ...validation.data,
      version: { increment: 1 },
    }

    // Convert date strings to Date objects
    if (validation.data.startDate) {
      updateData.startDate = new Date(validation.data.startDate)
    }
    if (validation.data.endDate) {
      updateData.endDate = new Date(validation.data.endDate)
    }

    return db.program.update({
      where: { id: programId },
      data: updateData,
    })
  })

  if (!program) {
    return ApiErrors.notFound("Program")
  }

  return successResponse(program, "Program updated")
})

export const DELETE = withAdmin<Params>(async (actor, _request: NextRequest, params) => {
  const { programId } = params!

  const program = await withRLS(actor, async (db) => {
    const existing = await db.program.findUnique({ where: { id: programId } })
    if (!existing || existing.deletedAt) {
      return null
    }

    return db.program.update({
      where: { id: programId },
      data: { deletedAt: new Date() },
    })
  })

  if (!program) {
    return ApiErrors.notFound("Program")
  }

  return successResponse(program, "Program deleted")
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
