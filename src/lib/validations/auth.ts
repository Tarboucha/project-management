import { z } from "zod"

export const loginSchema = z.object({
  email: z
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
})
export type LoginInput = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  email: z
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters").trim(),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters").trim(),
})
export type SignupInput = z.infer<typeof signupSchema>
