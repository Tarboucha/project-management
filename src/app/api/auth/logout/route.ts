import { createClient } from "@/lib/supabase/server"
import { ApiErrors, successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"

export async function POST() {
  try {
    const supabase = await createClient()

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      const errorMsg = signOutError.message.toLowerCase()
      if (errorMsg.includes("session") || errorMsg.includes("no session")) {
        return successResponse({ message: "No active session" }, "Already logged out")
      }
      return ApiErrors.serverError("Failed to sign out")
    }

    return successResponse({ message: "Successfully logged out" })
  } catch {
    return ApiErrors.serverError("An unexpected error occurred during logout")
  }
}

export async function GET() { return handleUnsupportedMethod(["POST"]) }
export async function PUT() { return handleUnsupportedMethod(["POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["POST"]) }
