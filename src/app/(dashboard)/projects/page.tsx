"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
import { FacetedFilter } from "@/components/shared/faceted-filter"
import { Search, Briefcase, FileDown, X, ArrowUp, ArrowDown } from "lucide-react"
import type { ProjectListItem as Project } from "@/types"
import { formatDate } from "@/lib/utils/format"


export default function ProjectsPage() {
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Multi-select lookup filters (initialized from URL for backward compat)
  const [activityIds, setActivityIds] = useState<string[]>(() => {
    const v = searchParams.get("activityId")
    return v ? v.split(",").filter(Boolean) : []
  })
  const [themeIds, setThemeIds] = useState<string[]>(() => {
    const v = searchParams.get("themeId")
    return v ? v.split(",").filter(Boolean) : []
  })
  const [categoryIds, setCategoryIds] = useState<string[]>(() => {
    const v = searchParams.get("categoryId")
    return v ? v.split(",").filter(Boolean) : []
  })

  // Search and sort
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("projectCode")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const buildParams = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams()
    params.set("limit", "20")
    if (cursor) params.set("cursor", cursor)
    if (search) params.set("search", search)
    if (activityIds.length > 0) params.set("activityId", activityIds.join(","))
    if (themeIds.length > 0) params.set("themeId", themeIds.join(","))
    if (categoryIds.length > 0) params.set("categoryId", categoryIds.join(","))
    params.set("sortBy", sortBy)
    params.set("sortOrder", sortOrder)
    return params
  }, [search, activityIds, themeIds, categoryIds, sortBy, sortOrder])

  // Data fetching effect
  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      setIsLoading(true)
      const params = buildParams()
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
  }, [buildParams])

  const loadMore = async () => {
    if (!nextCursor) return
    const params = buildParams(nextCursor)
    const res = await api.get(`/api/projects?${params}`)
    if (res.success) {
      const paginated = res as CursorPaginatedResult<Project>
      setProjects((prev) => [...prev, ...paginated.data])
      setNextCursor(paginated.nextCursor)
      setHasMore(paginated.hasMore)
    }
  }

  const toggleSort = (field: string) => {
    setIsLoading(true)
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const sortIcon = (field: string) => {
    if (sortBy !== field) return null
    return sortOrder === "asc"
      ? <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
  }

  const hasActiveFilters = activityIds.length > 0 || themeIds.length > 0 || categoryIds.length > 0

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
        <FacetedFilter
          title="Activity"
          apiPath="/api/lookups/activities"
          selected={activityIds}
          onSelectionChange={setActivityIds}
        />
        <FacetedFilter
          title="Theme"
          apiPath="/api/lookups/themes"
          selected={themeIds}
          onSelectionChange={setThemeIds}
        />
        <FacetedFilter
          title="Category"
          apiPath="/api/lookups/categories"
          selected={categoryIds}
          onSelectionChange={setCategoryIds}
        />
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setActivityIds([]); setThemeIds([]); setCategoryIds([]) }}
            className="h-8 px-2"
          >
            Clear all
            <X className="ml-1 h-3 w-3" />
          </Button>
        )}
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
            {search || hasActiveFilters
              ? "Try adjusting your search or filters"
              : "Projects will appear here once created under a program"}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("projectCode")}>Code{sortIcon("projectCode")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>Name{sortIcon("name")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("programName")}>Program{sortIcon("programName")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("state")}>State{sortIcon("state")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("progress")}>Progress{sortIcon("progress")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("startDate")}>Start Date{sortIcon("startDate")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("members")}>Members{sortIcon("members")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tasks")}>Tasks{sortIcon("tasks")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="text-muted-foreground font-mono text-xs">{project.projectCode}</TableCell>
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
