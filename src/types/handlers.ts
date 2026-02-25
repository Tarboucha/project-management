// ============================================================
// ROUTE HANDLER TYPE SIGNATURES — server-side only
// ============================================================

import type { NextRequest, NextResponse } from "next/server"
import type { Actor, ProjectRole } from "@/generated/prisma/client"

export type AuthenticatedHandler<TParams = Record<string, string>> = (
  actor: Actor,
  request: NextRequest,
  params?: TParams
) => Promise<NextResponse> | NextResponse

export interface WithAuthOptions {
  requireAdmin?: boolean
}

export type ProjectRoleHandler<TParams = Record<string, string>> = (
  actor: Actor,
  request: NextRequest,
  params?: TParams,
  projectRole?: ProjectRole
) => Promise<NextResponse> | NextResponse
