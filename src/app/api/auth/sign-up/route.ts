import { prisma } from "@/lib/prisma/client"
import { PrismaClientKnownRequestError } from "@prisma/client-runtime-utils"
import { signupSchema } from "@/lib/validations/auth"
import { hashPassword } from "@/lib/auth/password"
import { signToken } from "@/lib/auth/jwt"
import { setAuthCookie } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ApiErrors, parseZodError, successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const { allowed, retryAfterMs } = checkRateLimit(
      `signup:${ip}`,
      Number(process.env.RATE_LIMIT_SIGNUP_MAX) || 5,
      Number(process.env.RATE_LIMIT_SIGNUP_WINDOW_MS) || 900000,
    )
    if (!allowed) {
      return ApiErrors.tooManyRequests(
        `Too many signup attempts. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      )
    }

    const body = await request.json()

    const validation = signupSchema.safeParse(body)
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error))
    }

    const { email, password, firstName, lastName } = validation.data

    const existing = await prisma.actor.findUnique({ where: { email } })
    if (existing) {
      return ApiErrors.conflict("An account with this email already exists")
    }

    const passwordHash = await hashPassword(password)

    const actor = await prisma.actor.create({
      data: { email, passwordHash, firstName, lastName },
    })

    const token = signToken(actor.id)
    const response = successResponse({ message: "Account created successfully" })
    setAuthCookie(response, token)
    return response
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      return ApiErrors.conflict("An account with this email already exists")
    }
    return ApiErrors.serverError("An unexpected error occurred during signup")
  }
}

export async function GET() { return handleUnsupportedMethod(["POST"]) }
export async function PUT() { return handleUnsupportedMethod(["POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["POST"]) }
