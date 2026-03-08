import { verifyToken } from "@/lib/auth/jwt"
import { getTokenFromRequest } from "@/lib/auth/session"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const token = getTokenFromRequest(request)
  let isAuthenticated = false

  if (token) {
    try {
      verifyToken(token)
      isAuthenticated = true
    } catch {
      // expired or invalid
    }
  }

  // API routes handle their own auth
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next({ request })
  }

  const publicPages = ["/login", "/signup"]
  const isPublicRoute = publicPages.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}
