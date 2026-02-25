import { createClient } from "@/lib/supabase/server"
import { signupSchema } from "@/lib/validations/auth"
import { ApiErrors, parseZodError, successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = signupSchema.safeParse(body)
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error))
    }

    const { email, password, firstName, lastName } = validation.data

    const supabase = await createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    })

    if (authError) {
      if (authError.message.includes("already registered")) {
        return ApiErrors.conflict("An account with this email already exists")
      }
      return ApiErrors.serverError(authError.message || "Failed to create account")
    }

    if (!authData.user) {
      return ApiErrors.serverError("User creation failed")
    }

    const emailConfirmationRequired =
      !authData.session ||
      authData.user.identities?.length === 0

    return successResponse(
      { emailConfirmationRequired },
      emailConfirmationRequired
        ? "Account created. Please check your email to confirm your account."
        : "Account created successfully"
    )
  } catch {
    return ApiErrors.serverError("An unexpected error occurred during signup")
  }
}

export async function GET() { return handleUnsupportedMethod(["POST"]) }
export async function PUT() { return handleUnsupportedMethod(["POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["POST"]) }
