import { NextRequest } from "next/server"
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { withAnyAuth } from "@/lib/utils/api-route-helper"

export const GET = withAnyAuth(async (actor, _request: NextRequest) => {
  return successResponse({
    actor: {
      id: actor.id,
      firstName: actor.firstName,
      lastName: actor.lastName,
      email: actor.email,
      systemRole: actor.systemRole,
      isActive: actor.isActive,
      hourlyRate: actor.hourlyRate,
      createdAt: actor.createdAt,
      updatedAt: actor.updatedAt,
    },
  })
})

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
