"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/utils/api-client"
import { formatDate } from "@/lib/utils/format"
import type { CursorPaginatedResult } from "@/types/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Users, ChevronLeft, ChevronRight } from "lucide-react"

interface ActorListItem {
  id: string
  firstName: string
  lastName: string
  email: string
  systemRole: string
  isActive: boolean
  createdAt: string
}

const PAGE_SIZE = 20

export default function AdminActorsPage() {
  const [actors, setActors] = useState<ActorListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchPage = useCallback(async (cursor: string | null) => {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set("limit", String(PAGE_SIZE))
    if (cursor) params.set("cursor", cursor)
    if (search) params.set("search", search)

    const res = await api.get<ActorListItem[]>(`/api/actors?${params}`)
    if (res.success) {
      const paginated = res as CursorPaginatedResult<ActorListItem>
      setActors(paginated.data)
      setNextCursor(paginated.nextCursor)
      setHasMore(paginated.hasMore)
    }
    setIsLoading(false)
  }, [search])

  // Reset to first page on search change
  useEffect(() => {
    setCursorStack([])
    setCurrentCursor(null)
    fetchPage(null)
  }, [fetchPage])

  const goNext = () => {
    if (!nextCursor) return
    setCursorStack((prev) => [...prev, currentCursor ?? ""])
    setCurrentCursor(nextCursor)
    fetchPage(nextCursor)
  }

  const goPrev = () => {
    if (cursorStack.length === 0) return
    const prev = [...cursorStack]
    const prevCursor = prev.pop()!
    setCursorStack(prev)
    const cursor = prevCursor === "" ? null : prevCursor
    setCurrentCursor(cursor)
    fetchPage(cursor)
  }

  const pageNumber = cursorStack.length + 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground">All registered users</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : actors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No users found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? "Try adjusting your search" : "No users registered yet"}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actors.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.firstName} {a.lastName}
                    </TableCell>
                    <TableCell>{a.email}</TableCell>
                    <TableCell>
                      <Badge variant={a.systemRole === "ADMIN" ? "default" : "secondary"}>
                        {a.systemRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.isActive ? "default" : "destructive"}>
                        {a.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {pageNumber}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={cursorStack.length === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                disabled={!hasMore}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
