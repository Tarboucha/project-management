import { NextResponse } from "next/server"
import type { CursorPaginationParams, CursorPaginatedResult } from "@/types/api"

export type { CursorPaginationParams, CursorPaginatedResult }

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  FORBIDDEN: "FORBIDDEN",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  SERVER_ERROR: "SERVER_ERROR",
} as const

export function successResponse<T>(data: T, message?: string, status: number = HTTP_STATUS.OK): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status },
  )
}

export function errorResponse(
  message: string,
  code: string = ERROR_CODES.SERVER_ERROR,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status },
  )
}

export const ApiErrors = {
  validationError: (message: string, details?: Record<string, unknown>) =>
    errorResponse(message, ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, details),

  unauthorized: (message: string = "Authentication required") =>
    errorResponse(message, ERROR_CODES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED),

  invalidCredentials: (message: string = "Invalid email or password") =>
    errorResponse(message, ERROR_CODES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED),

  forbidden: (message: string = "Insufficient permissions") =>
    errorResponse(message, ERROR_CODES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN),

  notFound: (resource: string = "Resource") =>
    errorResponse(`${resource} not found`, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND),

  methodNotAllowed: (message: string = "Method not allowed") =>
    errorResponse(message, ERROR_CODES.METHOD_NOT_ALLOWED, HTTP_STATUS.METHOD_NOT_ALLOWED),

  conflict: (message: string) =>
    errorResponse(message, ERROR_CODES.ALREADY_EXISTS, HTTP_STATUS.CONFLICT),

  tooManyRequests: (message: string = "Too many requests. Please try again later.") =>
    errorResponse(message, ERROR_CODES.TOO_MANY_REQUESTS, HTTP_STATUS.TOO_MANY_REQUESTS),

  serverError: (message: string = "Internal server error") =>
    errorResponse(message, ERROR_CODES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR),
}

export function parseZodError(error: unknown): string {
  const err = error as { errors?: Array<{ path: (string | number)[]; message: string }> }
  if (err.errors && Array.isArray(err.errors)) {
    return err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
  }
  return "Validation error"
}

export function handleUnsupportedMethod(allowedMethods?: string[]): NextResponse {
  const message = allowedMethods
    ? `Method not allowed. Allowed methods: ${allowedMethods.join(", ")}`
    : "Method not allowed"
  return ApiErrors.methodNotAllowed(message)
}

// ============================================================
// PAGINATION & FILTERING
// ============================================================
// Cursor-based pagination: client sends ?cursor=<lastId>&limit=20
// Server returns { data, nextCursor } — no offset scanning.
// ============================================================

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100


/**
 * Parse cursor pagination from query params.
 * Usage: GET /api/tasks?cursor=<uuid>&limit=20
 */
export function parseCursorPagination(searchParams: URLSearchParams): CursorPaginationParams {
  const cursor = searchParams.get("cursor") || null
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  )

  return { cursor, limit }
}

/**
 * Build Prisma findMany args for cursor pagination.
 * Fetches limit+1 rows to determine if there's a next page.
 *
 * Usage:
 *   const prismaArgs = buildCursorPrismaArgs(params)
 *   const rows = await prisma.task.findMany({ ...prismaArgs, where: { ... } })
 *   return cursorPaginatedResponse(rows, params)
 */
export function buildCursorPrismaArgs(params: CursorPaginationParams) {
  return {
    take: params.limit + 1, // fetch one extra to detect hasMore
    ...(params.cursor && {
      cursor: { id: params.cursor },
      skip: 1, // skip the cursor row itself
    }),
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  }
}

/**
 * Build a cursor-paginated JSON response.
 * Pass the raw rows from Prisma (fetched with limit+1).
 */
export function cursorPaginatedResponse<T extends { id: string }>(
  rows: T[],
  params: CursorPaginationParams,
): NextResponse {
  const hasMore = rows.length > params.limit
  const data = hasMore ? rows.slice(0, params.limit) : rows
  const nextCursor = hasMore ? data[data.length - 1].id : null

  return NextResponse.json({
    success: true,
    data,
    nextCursor,
    hasMore,
  })
}

export function parseFilters(searchParams: URLSearchParams, allowedKeys: string[]): Record<string, string> {
  const filters: Record<string, string> = {}
  for (const key of allowedKeys) {
    const value = searchParams.get(key)
    if (value !== null && value !== "") {
      filters[key] = value
    }
  }
  return filters
}

export function parseMultiFilters(
  searchParams: URLSearchParams,
  allowedKeys: string[]
): Record<string, string[]> {
  const filters: Record<string, string[]> = {}
  for (const key of allowedKeys) {
    const value = searchParams.get(key)
    if (value !== null && value !== "") {
      filters[key] = value.split(",").filter(Boolean)
    }
  }
  return filters
}

export function parseSorting(
  searchParams: URLSearchParams,
  allowedFields: string[],
  defaultField: string = "createdAt",
  defaultOrder: "asc" | "desc" = "desc",
): { field: string; order: "asc" | "desc" } {
  const field = searchParams.get("sortBy") || defaultField
  const order = (searchParams.get("sortOrder") || defaultOrder) as "asc" | "desc"

  return {
    field: allowedFields.includes(field) ? field : defaultField,
    order: order === "asc" || order === "desc" ? order : defaultOrder,
  }
}
