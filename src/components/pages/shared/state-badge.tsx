"use client"

import { Badge } from "@/components/ui/badge"

interface StateBadgeProps {
  state: "ACTIVE" | "ENDED"
}

export function StateBadge({ state }: StateBadgeProps) {
  return (
    <Badge variant={state === "ACTIVE" ? "default" : "secondary"}>
      {state === "ACTIVE" ? "Active" : "Ended"}
    </Badge>
  )
}
