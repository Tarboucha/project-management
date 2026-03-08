import { prisma } from "@/lib/prisma/client"
import { loginSchema } from "@/lib/validations/auth"
import { verifyPassword } from "@/lib/auth/password"
import { signToken } from "@/lib/auth/jwt"
import { setAuthCookie } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ApiErrors, parseZodError, successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const { allowed, retryAfterMs } = checkRateLimit(
      `login:${ip}`,
      Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
      Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MS) || 900000,
    )
    if (!allowed) {
      return ApiErrors.tooManyRequests(
        `Too many login attempts. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      )
    }

    const body = await request.json()

    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error))
    }

    const { email, password } = validation.data

    const actor = await prisma.actor.findUnique({ where: { email } })
    if (!actor || actor.deletedAt || !actor.isActive) {
      return ApiErrors.invalidCredentials()
    }

    const valid = await verifyPassword(password, actor.passwordHash)
    if (!valid) {
      return ApiErrors.invalidCredentials()
    }

    const token = signToken(actor.id)
    const response = successResponse({ message: "Successfully logged in" })
    setAuthCookie(response, token)
    return response
  } catch {
    return ApiErrors.serverError()
  }
}

export async function GET() { return handleUnsupportedMethod(["POST"]) }
export async function PUT() { return handleUnsupportedMethod(["POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["POST"]) }
