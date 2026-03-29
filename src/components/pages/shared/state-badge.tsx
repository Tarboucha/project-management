"use client"

import { Badge } from "@/components/ui/badge"

interface StateBadgeProps {
  state: "ACTIVE" | "WAITING" | "ENDED" | "CANCELED"
}

const config: Record<StateBadgeProps["state"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  ACTIVE: { label: "Active", variant: "default" },
  WAITING: { label: "Waiting", variant: "outline" },
  ENDED: { label: "Ended", variant: "secondary" },
  CANCELED: { label: "Canceled", variant: "destructive" },
}

export function StateBadge({ state }: StateBadgeProps) {
  const { label, variant } = config[state] ?? { label: state, variant: "secondary" as const }
  return <Badge variant={variant}>{label}</Badge>
}
