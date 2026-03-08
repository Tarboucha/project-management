import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const COOKIE_NAME = "ppm-token"
const IS_PROD = process.env.NODE_ENV === "production"

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: Number(process.env.JWT_EXPIRES_IN) || 10800, // default 3 hours
  })
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME)
}

export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null
}
