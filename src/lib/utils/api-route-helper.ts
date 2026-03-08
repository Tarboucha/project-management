import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt"
import { getTokenFromRequest } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma/client"
import { ApiErrors } from "@/lib/utils/api-response"
import type { Actor, ProjectRole } from "@/generated/prisma/client"
import type { AuthenticatedHandler, WithAuthOptions, ProjectRoleHandler } from "@/types/handlers"

// ============================================================
// PROJECT ROLE HIERARCHY
// ============================================================

const PROJECT_ROLE_LEVEL: Record<ProjectRole, number> = {
  CONTRIBUTOR: 1,
  MANAGER: 2,
  DIRECTOR: 3,
}

function hasMinProjectRole(actorRole: ProjectRole, minRole: ProjectRole): boolean {
  return PROJECT_ROLE_LEVEL[actorRole] >= PROJECT_ROLE_LEVEL[minRole]
}

// ============================================================
// CORE AUTH
// ============================================================

export async function getAuthenticatedActor(request: NextRequest): Promise<Actor> {
  const token = getTokenFromRequest(request)
  if (!token) throw new Error("UNAUTHORIZED")

  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw new Error("UNAUTHORIZED")
  }

  const actor = await prisma.actor.findUnique({
    where: { id: payload.sub },
  })

  if (!actor || actor.deletedAt || !actor.isActive) {
    throw new Error("UNAUTHORIZED")
  }

  return actor
}

// ============================================================
// SYSTEM ROLE WRAPPERS
// ============================================================

export function withAuth<TParams = Record<string, string>>(
  handler: AuthenticatedHandler<TParams>,
  options: WithAuthOptions = {}
) {
  const { requireAdmin = false } = options

  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    try {
      const actor = await getAuthenticatedActor(request)

      if (requireAdmin && actor.systemRole !== "ADMIN") {
        return ApiErrors.forbidden("Admin access required")
      }

      let params: TParams | undefined
      if (context?.params) {
        params = await context.params
      }

      return await handler(actor, request, params)
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        return ApiErrors.unauthorized()
      }

      console.error("[API Route Error]", {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error.message,
      })

      return ApiErrors.serverError()
    }
  }
}

export function withAdmin<TParams = Record<string, string>>(
  handler: AuthenticatedHandler<TParams>
) {
  return withAuth(handler, { requireAdmin: true })
}

export function withAnyAuth<TParams = Record<string, string>>(
  handler: AuthenticatedHandler<TParams>
) {
  return withAuth(handler)
}

// ============================================================
// PROJECT ROLE WRAPPERS
// ============================================================

/**
 * Requires the actor to be a project member with at least `minRole`.
 * Extracts projectId from route params.
 * Passes the actor's projectRole to the handler for ownership checks.
 *
 * Usage:
 *   export const GET = withProjectRole("CONTRIBUTOR", async (actor, req, params, projectRole) => {
 *     // CONTRIBUTOR can only see their own tasks, MANAGER+ sees all
 *     if (projectRole === "CONTRIBUTOR") { ... }
 *   })
 */
export function withProjectRole<TParams extends { projectId: string } = { projectId: string }>(
  minRole: ProjectRole,
  handler: ProjectRoleHandler<TParams>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    try {
      const actor = await getAuthenticatedActor(request)

      let params: TParams | undefined
      if (context?.params) {
        params = await context.params
      }

      const projectId = params?.projectId
      if (!projectId) {
        return ApiErrors.validationError("Project ID is required")
      }

      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_actorId: { projectId, actorId: actor.id },
        },
      })

      if (!membership || membership.deletedAt || !hasMinProjectRole(membership.role, minRole)) {
        return ApiErrors.forbidden(
          `Requires at least ${minRole} role on this project`
        )
      }

      return await handler(actor, request, params, membership.role)
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        return ApiErrors.unauthorized()
      }

      console.error("[API Route Error]", {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error.message,
      })

      return ApiErrors.serverError()
    }
  }
}

/**
 * System ADMINs bypass the project role check.
 * Otherwise requires at least `minRole` on the project.
 *
 * Usage:
 *   export const DELETE = withAdminOrProjectRole("DIRECTOR", async (actor, req, params) => { ... })
 */
export function withAdminOrProjectRole<TParams extends { projectId: string } = { projectId: string }>(
  minRole: ProjectRole,
  handler: ProjectRoleHandler<TParams>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    try {
      const actor = await getAuthenticatedActor(request)

      let params: TParams | undefined
      if (context?.params) {
        params = await context.params
      }

      const projectId = params?.projectId
      if (!projectId) {
        return ApiErrors.validationError("Project ID is required")
      }

      // ADMINs bypass project role checks
      let projectRole: ProjectRole | undefined
      if (actor.systemRole !== "ADMIN") {
        const membership = await prisma.projectMember.findUnique({
          where: {
            projectId_actorId: { projectId, actorId: actor.id },
          },
        })

        if (!membership || membership.deletedAt || !hasMinProjectRole(membership.role, minRole)) {
          return ApiErrors.forbidden(
            `Requires admin or at least ${minRole} role on this project`
          )
        }
        projectRole = membership.role
      }

      return await handler(actor, request, params, projectRole)
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        return ApiErrors.unauthorized()
      }

      console.error("[API Route Error]", {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error.message,
      })

      return ApiErrors.serverError()
    }
  }
}
