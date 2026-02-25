// ============================================================
// SHARED API TYPES — used by both client & server
// ============================================================

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  message?: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================================
// PAGINATION
// ============================================================

export interface CursorPaginationParams {
  cursor: string | null
  limit: number
}

export interface CursorPaginatedResult<T> {
  success: true
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}
