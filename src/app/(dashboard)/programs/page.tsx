"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth-store"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { ProgramFormDialog } from "@/components/pages/programs/program-form-dialog"
import { Plus, Search, FolderKanban, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"
import type { Program } from "@/types"
import { formatDate } from "@/lib/utils/format"


export default function ProgramsPage() {
  const { isAdmin } = useAuthStore()

  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  // Refetch trigger — bump to re-run the effect from event handlers
  const [fetchKey, setFetchKey] = useState(0)

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | undefined>()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Data fetching effect — no synchronous setState before await
  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const params = new URLSearchParams()
      params.set("limit", "20")
      if (stateFilter !== "all") params.set("state", stateFilter)
      if (search) params.set("search", search)
      params.set("sortBy", sortBy)
      params.set("sortOrder", sortOrder)

      const res = await api.get(`/api/programs?${params}`)
      if (cancelled) return
      if (res.success) {
        const paginated = res as CursorPaginatedResult<Program>
        setPrograms(paginated.data)
        setNextCursor(paginated.nextCursor)
        setHasMore(paginated.hasMore)
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [search, stateFilter, sortBy, sortOrder, fetchKey])

  const refetch = () => {
    setIsLoading(true)
    setFetchKey((k) => k + 1)
  }

  const loadMore = async () => {
    if (!nextCursor) return
    const params = new URLSearchParams()
    params.set("cursor", nextCursor)
    params.set("limit", "20")
    if (stateFilter !== "all") params.set("state", stateFilter)
    if (search) params.set("search", search)
    params.set("sortBy", sortBy)
    params.set("sortOrder", sortOrder)

    const res = await api.get(`/api/programs?${params}`)
    if (res.success) {
      const paginated = res as CursorPaginatedResult<Program>
      setPrograms((prev) => [...prev, ...paginated.data])
      setNextCursor(paginated.nextCursor)
      setHasMore(paginated.hasMore)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    const res = await api.delete(`/api/programs/${deletingId}`)
    if (res.success) {
      toast.success("Program deleted")
      refetch()
    } else {
      toast.error("Failed to delete program")
    }
    setIsDeleting(false)
    setDeleteOpen(false)
    setDeletingId(null)
  }

  const openEdit = (program: Program) => {
    setEditingProgram(program)
    setFormOpen(true)
  }

  const openCreate = () => {
    setEditingProgram(undefined)
    setFormOpen(true)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
          <p className="text-muted-foreground">Manage your portfolio programs</p>
        </div>
        {isAdmin() && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Program
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search programs..."
            value={search}
            onChange={(e) => { setIsLoading(true); setSearch(e.target.value) }}
            className="pl-9"
          />
        </div>
        <Select value={stateFilter} onValueChange={(v) => { setIsLoading(true); setStateFilter(v) }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
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
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No programs found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || stateFilter !== "all"
              ? "Try adjusting your filters"
              : "Get started by creating your first program"}
          </p>
          {isAdmin() && !search && stateFilter === "all" && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Program
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>Name{sortIcon("name")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("state")}>State{sortIcon("state")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("startDate")}>Start Date{sortIcon("startDate")}</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Created By</TableHead>
                  {isAdmin() && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell>
                      <Link
                        href={`/programs/${program.id}`}
                        className="font-medium hover:underline"
                      >
                        {program.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StateBadge state={program.state} />
                    </TableCell>
                    <TableCell>{formatDate(program.startDate)}</TableCell>
                    <TableCell>{program._count.projects}</TableCell>
                    <TableCell>
                      {program.budgetEstimated
                        ? `${Number(program.budgetEstimated).toLocaleString()} ${program.currency ?? "EUR"}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {program.createdBy.firstName} {program.createdBy.lastName}
                    </TableCell>
                    {isAdmin() && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(program)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                              setDeletingId(program.id)
                              setDeleteOpen(true)
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    )}
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

      <ProgramFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={refetch}
        program={editingProgram}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Program"
        description="Are you sure you want to delete this program? This action cannot be undone."
        isLoading={isDeleting}
      />
    </div>
  )
}
