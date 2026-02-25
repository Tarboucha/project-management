import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})
export type LoginInput = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  email: z
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters").trim(),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters").trim(),
})
export type SignupInput = z.infer<typeof signupSchema>
