"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/utils/api-client"
import { useAuthStore } from "@/lib/stores/auth-store"
import type { CursorPaginatedResult } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { StateBadge } from "@/components/pages/shared/state-badge"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { AuditLogDialog } from "@/components/pages/shared/audit-log-dialog"
import { TaskFormDialog } from "@/components/pages/projects/task-form-dialog"
import { Plus, Pencil, Trash2, Search, History, Check, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"
import type { TaskListItem as Task } from "@/types"
import { priorityVariant } from "@/lib/utils/badges"

interface TasksSectionProps {
  projectId: string
  projectRole?: "DIRECTOR" | "MANAGER" | "CONTRIBUTOR"
}

export function TasksSection({ projectId, projectRole }: TasksSectionProps) {
  const { isAdmin } = useAuthStore()
  const admin = isAdmin()

  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Sorting
  const [sortBy, setSortBy] = useState("taskOrder")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  // Filters
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTask, setHistoryTask] = useState<Task | null>(null)

  // Progress editing
  const [progressTaskId, setProgressTaskId] = useState<string | null>(null)
  const [progressValue, setProgressValue] = useState(0)
  const [savingProgress, setSavingProgress] = useState(false)

  const canManage = admin || projectRole === "DIRECTOR" || projectRole === "MANAGER"

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (stateFilter !== "all") params.set("state", stateFilter)
      if (priorityFilter !== "all") params.set("priority", priorityFilter)
      params.set("limit", "50")
      params.set("sortBy", sortBy)
      params.set("sortOrder", sortOrder)

      const res = await api.get<Task[]>(
        `/api/projects/${projectId}/tasks?${params.toString()}`
      )
      if (cancelled) return
      const paginated = res as CursorPaginatedResult<Task>
      if (paginated.success) {
        setTasks(paginated.data)
      }
      setIsLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [projectId, fetchKey, search, stateFilter, priorityFilter, sortBy, sortOrder])

  const refetch = () => {
    setIsLoading(true)
    setFetchKey((k) => k + 1)
  }

  const handleDelete = async () => {
    if (!deletingTask) return
    setDeleteLoading(true)
    const res = await api.delete(`/api/projects/${projectId}/tasks/${deletingTask.id}`)
    if (res.success) {
      toast.success("Task deleted")
      refetch()
    } else {
      toast.error("Failed to delete task")
    }
    setDeleteLoading(false)
    setDeleteOpen(false)
    setDeletingTask(null)
  }

  const handleProgressSave = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    setSavingProgress(true)
    const res = await api.patch(`/api/projects/${projectId}/tasks/${taskId}`, {
      version: task.version,
      progress: progressValue,
    })
    if (res.success) {
      toast.success("Progress updated")
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, version: t.version + 1, progress: progressValue } : t))
      )
      setProgressTaskId(null)
    } else {
      toast.error("Failed to update progress")
    }
    setSavingProgress(false)
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tasks ({tasks.length})</h2>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditingTask(null)
              setFormOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-8 w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 cursor-pointer select-none" onClick={() => toggleSort("taskOrder")}>Ord{sortIcon("taskOrder")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("objective")}>Objective{sortIcon("objective")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("priority")}>Priority{sortIcon("priority")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("state")}>State{sortIcon("state")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("progress")}>Progress{sortIcon("progress")}</TableHead>
                <TableHead>Owner</TableHead>
                {canManage && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="text-muted-foreground">{task.taskOrder}</TableCell>
                  <TableCell className="font-medium max-w-[250px]">
                    <Link
                      href={`/projects/${projectId}/tasks/${task.id}`}
                      className="block truncate hover:underline"
                    >
                      {task.objective}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(task.priority)}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StateBadge state={task.state} />
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Popover
                        open={progressTaskId === task.id}
                        onOpenChange={(open) => {
                          if (open) {
                            setProgressTaskId(task.id)
                            setProgressValue(task.progress)
                          } else {
                            setProgressTaskId(null)
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 min-w-[100px] cursor-pointer hover:opacity-70">
                            <Progress value={task.progress} className="h-2 w-16" />
                            <span className="text-sm text-muted-foreground">{task.progress}%</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="start">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Progress</span>
                              <span className="text-sm text-muted-foreground">{progressValue}%</span>
                            </div>
                            <Slider
                              value={[progressValue]}
                              onValueChange={([v]) => setProgressValue(v)}
                              min={0}
                              max={100}
                              step={5}
                            />
                            <Button
                              size="sm"
                              className="w-full"
                              disabled={savingProgress || progressValue === task.progress}
                              onClick={() => handleProgressSave(task.id)}
                            >
                              <Check className="mr-2 h-3 w-3" />
                              {savingProgress ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={task.progress} className="h-2 w-16" />
                        <span className="text-sm text-muted-foreground">{task.progress}%</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.owner ? (
                      <span className="text-sm">
                        {task.owner.firstName} {task.owner.lastName[0]}.
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setHistoryTask(task)
                            setHistoryOpen(true)
                          }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTask(task)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setDeletingTask(task)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={refetch}
        projectId={projectId}
        task={editingTask ?? undefined}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Task"
        description={
          deletingTask
            ? `Delete task "${deletingTask.objective}"? This action cannot be undone.`
            : ""
        }
        isLoading={deleteLoading}
      />

      <AuditLogDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        tableName="task"
        recordId={historyTask?.id ?? ""}
        entityLabel={historyTask?.objective ?? "Task"}
        apiBasePath={`/api/projects/${projectId}/audit-log`}
      />
    </div>
  )
}
