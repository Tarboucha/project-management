"use client"

import { LoginForm } from "@/components/pages/auth/login-form"
import { AuthPageWrapper } from "@/components/pages/auth/auth-page-wrapper"

export default function LoginPage() {
  return (
    <AuthPageWrapper>
      <LoginForm />
    </AuthPageWrapper>
  )
}
