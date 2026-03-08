"use client"

import { useAuthStore } from "@/lib/stores/auth-store"
import { SummaryCard } from "@/components/pages/dashboard/summary-card"
import { DashboardSkeleton } from "@/components/pages/dashboard/dashboard-skeleton"
import { FolderKanban, Briefcase, ClipboardList } from "lucide-react"

export default function DashboardPage() {
  const { actor, isLoading, isInitialized } = useAuthStore()

  if (!isInitialized || isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {actor?.firstName ?? "User"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Programs"
          value="--"
          description="Active programs"
          icon={FolderKanban}
        />
        <SummaryCard
          title="Projects"
          value="--"
          description="Active projects"
          icon={Briefcase}
        />
        <SummaryCard
          title="My Tasks"
          value="--"
          description="Tasks assigned to you"
          icon={ClipboardList}
        />
      </div>
    </div>
  )
}
