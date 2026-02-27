"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { StateBadge } from "@/components/pages/shared/state-badge"
import { Search, Briefcase, FileDown } from "lucide-react"

interface Project {
  id: string
  name: string
  state: "ACTIVE" | "ENDED"
  progress: number
  startDate: string
  program: { id: string; name: string }
  _count: { members: number; tasks: number }
}


export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Data fetching effect
  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const params = new URLSearchParams()
      params.set("limit", "20")
      if (stateFilter !== "all") params.set("state", stateFilter)
      if (search) params.set("search", search)
      params.set("sortBy", sortBy)
      params.set("sortOrder", sortOrder)

      const res = await api.get(`/api/projects?${params}`)
      if (cancelled) return
      if (res.success) {
        const paginated = res as CursorPaginatedResult<Project>
        setProjects(paginated.data)
        setNextCursor(paginated.nextCursor)
        setHasMore(paginated.hasMore)
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [search, stateFilter, sortBy, sortOrder])

  const loadMore = async () => {
    if (!nextCursor) return
    const params = new URLSearchParams()
    params.set("cursor", nextCursor)
    params.set("limit", "20")
    if (stateFilter !== "all") params.set("state", stateFilter)
    if (search) params.set("search", search)
    params.set("sortBy", sortBy)
    params.set("sortOrder", sortOrder)

    const res = await api.get(`/api/projects?${params}`)
    if (res.success) {
      const paginated = res as CursorPaginatedResult<Project>
      setProjects((prev) => [...prev, ...paginated.data])
      setNextCursor(paginated.nextCursor)
      setHasMore(paginated.hasMore)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">All projects across programs</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => { setIsLoading(true); setSearch(e.target.value) }}
            className="pl-9"
          />
        </div>
        <Select value={stateFilter} onValueChange={(v) => { setIsLoading(true); setStateFilter(v) }}>
          <SelectTrigger className="w-32.5">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => { setIsLoading(true); setSortBy(v) }}>
          <SelectTrigger className="w-37.5">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Created Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="startDate">Start Date</SelectItem>
            <SelectItem value="progress">Progress</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={(v) => { setIsLoading(true); setSortOrder(v as "asc" | "desc") }}>
          <SelectTrigger className="w-27.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest</SelectItem>
            <SelectItem value="asc">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Briefcase className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No projects found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || stateFilter !== "all"
              ? "Try adjusting your filters"
              : "Projects will appear here once created under a program"}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/programs/${project.program.id}`}
                        className="text-muted-foreground hover:underline"
                      >
                        {project.program.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StateBadge state={project.state} />
                    </TableCell>
                    <TableCell>{project.progress}%</TableCell>
                    <TableCell>{formatDate(project.startDate)}</TableCell>
                    <TableCell>{project._count.members}</TableCell>
                    <TableCell>{project._count.tasks}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={`/api/projects/${project.id}/report`} target="_blank" rel="noopener noreferrer">
                          <FileDown className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
