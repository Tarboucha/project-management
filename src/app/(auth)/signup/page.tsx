"use client"

import { SignUpForm } from "@/components/pages/auth/sign-up-form"
import { AuthPageWrapper } from "@/components/pages/auth/auth-page-wrapper"

export default function SignUpPage() {
  return (
    <AuthPageWrapper>
      <SignUpForm />
    </AuthPageWrapper>
  )
}
