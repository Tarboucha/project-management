import { createClient } from "@/lib/supabase/server"
import { loginSchema } from "@/lib/validations/auth"
import { ApiErrors, parseZodError, successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error))
    }

    const { email, password } = validation.data

    const supabase = await createClient()

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      const errorMsg = authError.message.toLowerCase()

      if (errorMsg.includes("email not confirmed") || errorMsg.includes("email_not_confirmed")) {
        return ApiErrors.emailNotConfirmed()
      }

      return ApiErrors.invalidCredentials()
    }

    if (!authData.user) {
      return ApiErrors.invalidCredentials()
    }

    return successResponse({ message: "Successfully logged in" })
  } catch {
    return ApiErrors.serverError()
  }
}

export async function GET() { return handleUnsupportedMethod(["POST"]) }
export async function PUT() { return handleUnsupportedMethod(["POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["POST"]) }
