"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"
import { api } from "@/lib/utils/api-client"
import { toast } from "sonner"
import type { CursorPaginatedResult } from "@/types/api"
import type { NamedEntity as LookupItem } from "@/types"

interface LookupSelectFieldProps {
  label: string
  apiPath: string
  value: string
  onChange: (id: string) => void
  parentOpen: boolean
  disabled?: boolean
}

export function LookupSelectField({
  label,
  apiPath,
  value,
  onChange,
  parentOpen,
  disabled,
}: LookupSelectFieldProps) {
  const [items, setItems] = useState<LookupItem[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchItems = useCallback(async () => {
    const res = await api.get<LookupItem[]>(`${apiPath}?isActive=true&limit=100`)
    const paginated = res as CursorPaginatedResult<LookupItem>
    if (paginated.success) {
      setItems(paginated.data)
    }
  }, [apiPath])

  useEffect(() => {
    if (parentOpen) {
      fetchItems()
    }
  }, [parentOpen, fetchItems])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = (formData.get("name") as string).trim()
    const code = (formData.get("code") as string).trim()

    if (!code) {
      toast.error("Code is required")
      return
    }
    const description = (formData.get("description") as string).trim() || undefined

    if (!name) {
      toast.error("Name is required")
      return
    }

    setCreating(true)
    try {
      const res = await api.post<LookupItem>(apiPath, { name, code, description })
      if (!res.success) {
        throw new Error(res.error.message)
      }
      toast.success(`${label} created`)
      await fetchItems()
      onChange(res.data.id)
      setCreateOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setCreateOpen(true)}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Create {label}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`lookup-name-${label}`}>Name *</Label>
                <Input
                  id={`lookup-name-${label}`}
                  name="name"
                  required
                  maxLength={255}
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`lookup-code-${label}`}>Code *</Label>
                <Input
                  id={`lookup-code-${label}`}
                  name="code"
                  required
                  maxLength={50}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`lookup-desc-${label}`}>Description</Label>
              <Textarea
                id={`lookup-desc-${label}`}
                name="description"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
