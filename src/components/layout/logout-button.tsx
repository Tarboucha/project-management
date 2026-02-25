"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/stores/auth-store"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const { clearActor } = useAuthStore()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      clearActor()
      toast.success("Successfully logged out")
      router.push("/login")
      router.refresh()
    } catch {
      clearActor()
      toast.error("An error occurred during logout")
      router.push("/login")
      router.refresh()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <DropdownMenuItem
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="cursor-pointer"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isLoggingOut ? "Logging out..." : "Log out"}
    </DropdownMenuItem>
  )
}
