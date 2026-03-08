import { clearAuthCookie } from "@/lib/auth/session"
import { successResponse, ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response"

export async function POST() {
  try {
    const response = successResponse({ message: "Successfully logged out" })
    clearAuthCookie(response)
    return response
  } catch {
    return ApiErrors.serverError("An unexpected error occurred during logout")
  }
}

export async function GET() { return handleUnsupportedMethod(["POST"]) }
export async function PUT() { return handleUnsupportedMethod(["POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["POST"]) }
