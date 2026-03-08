"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/utils/api-client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { TodoFormDialog } from "@/components/pages/projects/todo-form-dialog"
import { ListTodo, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { TodoItem, ActorSummary } from "@/types"

interface TodosSectionProps {
  projectId: string
  canManage: boolean
  members: Array<{ actorId: string; actor: ActorSummary }>
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString()
}

export function TodosSection({ projectId, canManage, members }: TodosSectionProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingTodo, setDeletingTodo] = useState<TodoItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const doFetch = async () => {
      const res = await api.get<TodoItem[]>(`/api/projects/${projectId}/todos`)
      if (cancelled) return
      if (res.success) {
        setTodos(res.data)
      }
      setIsLoading(false)
    }
    doFetch()
    return () => { cancelled = true }
  }, [projectId, fetchKey])

  const refetch = () => {
    setIsLoading(true)
    setFetchKey((k) => k + 1)
  }

  const handleDelete = async () => {
    if (!deletingTodo) return
    setDeleteLoading(true)
    const res = await api.delete(`/api/projects/${projectId}/todos/${deletingTodo.id}`)
    if (res.success) {
      toast.success("Todo deleted")
      refetch()
    } else {
      toast.error("Failed to delete todo")
    }
    setDeleteLoading(false)
    setDeleteOpen(false)
    setDeletingTodo(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Todos</h2>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setEditingTodo(null); setFormOpen(true) }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Todo
          </Button>
        )}
      </div>

      {todos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
          <ListTodo className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No action items yet</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Delivery</TableHead>
                <TableHead className="w-[150px]">Responsible</TableHead>
                <TableHead>Comments</TableHead>
                {canManage && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {todos.map((todo) => (
                <TableRow key={todo.id}>
                  <TableCell className="text-muted-foreground">{todo.todoOrder}</TableCell>
                  <TableCell className="font-medium">{todo.action}</TableCell>
                  <TableCell>
                    <Badge variant={todo.status === "ACTIVE" ? "default" : "secondary"}>
                      {todo.status === "ACTIVE" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(todo.deliveryDate)}</TableCell>
                  <TableCell className="text-sm">
                    {todo.responsible
                      ? `${todo.responsible.firstName} ${todo.responsible.lastName}`
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {todo.comments || "—"}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => { setEditingTodo(todo); setFormOpen(true) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => { setDeletingTodo(todo); setDeleteOpen(true) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form dialog */}
      <TodoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={refetch}
        projectId={projectId}
        members={members}
        todo={editingTodo ?? undefined}
      />

      {/* Delete dialog */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Todo"
        description={
          deletingTodo
            ? `Delete todo "${deletingTodo.action}"? This action cannot be undone.`
            : ""
        }
        isLoading={deleteLoading}
      />
    </div>
  )
}
