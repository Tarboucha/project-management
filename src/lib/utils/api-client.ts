/**
 * Client-side fetch wrapper with retry + exponential backoff.
 * Use this in components/stores instead of raw fetch().
 */

import type { ApiResponse } from "@/types/api"
import { useAuthStore } from "@/lib/stores/auth-store"

export type { ApiResponse }

interface ApiClientOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  maxRetries?: number
  baseDelay?: number
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

function isRetryable(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status)
}

function getRetryDelay(attempt: number, baseDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt)
  // Add jitter: ±25% randomness to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1)
  return Math.min(delay + jitter, 30000) // cap at 30s
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function apiClient<T>(
  url: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const { body, maxRetries = 3, baseDelay = 500, ...fetchOptions } = options

  const config: RequestInit = {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, config)

      // Redirect to login on 401 from non-auth API calls (expired/invalid token)
      if (
        response.status === 401 &&
        typeof window !== "undefined" &&
        !url.startsWith("/api/auth/")
      ) {
        useAuthStore.getState().clearActor()
        window.location.href = "/login"
        return { success: false, error: { code: "AUTH_REQUIRED", message: "Session expired" } }
      }

      // Don't retry client errors (except retryable ones)
      if (!response.ok && !isRetryable(response.status)) {
        return await response.json()
      }

      // Retry on retryable status codes
      if (!response.ok && isRetryable(response.status) && attempt < maxRetries) {
        // Respect Retry-After header if present
        const retryAfter = response.headers.get("Retry-After")
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : getRetryDelay(attempt, baseDelay)
        await sleep(delay)
        continue
      }

      return await response.json()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Network errors are retryable
      if (attempt < maxRetries) {
        await sleep(getRetryDelay(attempt, baseDelay))
        continue
      }
    }
  }

  return {
    success: false,
    error: {
      code: "NETWORK_ERROR",
      message: lastError?.message || "Failed to connect to server",
    },
  }
}

// Convenience methods
export const api = {
  get: <T>(url: string, options?: Omit<ApiClientOptions, "method" | "body">) =>
    apiClient<T>(url, { ...options, method: "GET" }),

  post: <T>(url: string, body?: unknown, options?: Omit<ApiClientOptions, "method" | "body">) =>
    apiClient<T>(url, { ...options, method: "POST", body }),

  patch: <T>(url: string, body?: unknown, options?: Omit<ApiClientOptions, "method" | "body">) =>
    apiClient<T>(url, { ...options, method: "PATCH", body }),

  put: <T>(url: string, body?: unknown, options?: Omit<ApiClientOptions, "method" | "body">) =>
    apiClient<T>(url, { ...options, method: "PUT", body }),

  delete: <T>(url: string, options?: Omit<ApiClientOptions, "method" | "body">) =>
    apiClient<T>(url, { ...options, method: "DELETE" }),
}
