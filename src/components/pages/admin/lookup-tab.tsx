"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { Plus, Pencil, Trash2, Search, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface LookupItem {
  id: string
  name: string
  code?: string | null
  description?: string | null
  isActive: boolean
  _count: { projects: number }
}

interface LookupTabProps {
  type: "activities" | "themes" | "categories"
  label: string
  filterParam: string // activityId, themeId, categoryId
}

export function LookupTab({ type, label, filterParam }: LookupTabProps) {
  const [items, setItems] = useState<LookupItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editItem, setEditItem] = useState<LookupItem | null>(null)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteItem, setDeleteItem] = useState<LookupItem | null>(null)

  const apiPath = `/api/lookups/${type}`

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const params = new URLSearchParams()
      params.set("limit", "20")
      if (search) params.set("search", search)

      const res = await api.get(`${apiPath}?${params}`)
      if (cancelled) return
      if (res.success) {
        const paginated = res as CursorPaginatedResult<LookupItem>
        setItems(paginated.data)
        setNextCursor(paginated.nextCursor)
        setHasMore(paginated.hasMore)
      }
      setIsLoading(false)
    }

    setIsLoading(true)
    doFetch()
    return () => { cancelled = true }
  }, [apiPath, search])

  const loadMore = async () => {
    if (!nextCursor) return
    const params = new URLSearchParams()
    params.set("cursor", nextCursor)
    params.set("limit", "20")
    if (search) params.set("search", search)

    const res = await api.get(`${apiPath}?${params}`)
    if (res.success) {
      const paginated = res as CursorPaginatedResult<LookupItem>
      setItems((prev) => [...prev, ...paginated.data])
      setNextCursor(paginated.nextCursor)
      setHasMore(paginated.hasMore)
    }
  }

  const refetch = () => {
    setIsLoading(true)
    setSearch((s) => s) // trigger useEffect
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = (formData.get("name") as string).trim()
    const code = (formData.get("code") as string).trim()

    if (!code) { toast.error("Code is required"); return }
    const description = (formData.get("description") as string).trim() || undefined

    if (!name) { toast.error("Name is required"); return }

    setCreating(true)
    try {
      const res = await api.post(apiPath, { name, code, description })
      if (!res.success) throw new Error(res.error.message)
      toast.success(`${label} created`)
      setCreateOpen(false)
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setCreating(false)
    }
  }

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editItem) return
    const formData = new FormData(e.currentTarget)
    const name = (formData.get("name") as string).trim()
    const code = (formData.get("code") as string).trim()

    if (!code) { toast.error("Code is required"); return }
    const description = (formData.get("description") as string).trim() || undefined
    const isActive = formData.get("isActive") === "on"

    if (!name) { toast.error("Name is required"); return }

    setEditing(true)
    try {
      const res = await api.patch(`${apiPath}/${editItem.id}`, { name, code, description, isActive })
      if (!res.success) throw new Error(res.error.message)
      toast.success(`${label} updated`)
      setEditOpen(false)
      setEditItem(null)
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    setDeleting(true)
    const res = await api.delete(`${apiPath}/${deleteItem.id}`)
    if (res.success) {
      toast.success(`${label} deleted`)
      refetch()
    } else {
      toast.error("Failed to delete")
    }
    setDeleting(false)
    setDeleteOpen(false)
    setDeleteItem(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${type}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add {label}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <h3 className="mt-4 text-lg font-medium">No {type} found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? "Try adjusting your search" : `Create your first ${label.toLowerCase()}`}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[90px]">Projects</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {item.code || "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/projects?${filterParam}=${item.id}`}
                        className="hover:underline"
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                      {item.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item._count.projects > 0 ? (
                        <Link
                          href={`/projects?${filterParam}=${item.id}`}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {item._count.projects}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditItem(item); setEditOpen(true) }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => { setDeleteItem(item); setDeleteOpen(true) }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>Load More</Button>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Create {label}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input id="create-name" name="name" required maxLength={255} autoFocus />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-code">Code *</Label>
                <Input id="create-code" name="code" required maxLength={50} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-desc">Description</Label>
              <Textarea id="create-desc" name="description" rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditItem(null) }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit {label}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input id="edit-name" name="name" required maxLength={255} defaultValue={editItem.name} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-code">Code *</Label>
                  <Input id="edit-code" name="code" required maxLength={50} defaultValue={editItem.code ?? ""} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" name="description" rows={2} defaultValue={editItem.description ?? ""} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit-active" name="isActive" defaultChecked={editItem.isActive} />
                <Label htmlFor="edit-active">Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editing}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editing}>
                  {editing ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title={`Delete ${label}`}
        description={deleteItem ? `Delete "${deleteItem.name}"? This action cannot be undone.` : ""}
        isLoading={deleting}
      />
    </div>
  )
}
