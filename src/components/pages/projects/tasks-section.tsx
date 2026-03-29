"use client"

import { useEffect, useReducer } from "react"
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

// ── State & Actions ──────────────────────────────────────────

interface TasksState {
  tasks: Task[]
  isLoading: boolean
  fetchKey: number
  // Sorting
  sortBy: string
  sortOrder: "asc" | "desc"
  // Filters
  search: string
  stateFilter: string
  priorityFilter: string
  // Dialogs
  formOpen: boolean
  editingTask: Task | null
  deleteOpen: boolean
  deletingTask: Task | null
  deleteLoading: boolean
  historyOpen: boolean
  historyTask: Task | null
  // Progress
  progressTaskId: string | null
  progressValue: number
  savingProgress: boolean
}

type TasksAction =
  | { type: "SET_TASKS"; tasks: Task[] }
  | { type: "UPDATE_TASK_PROGRESS"; taskId: string; progress: number }
  | { type: "REFETCH" }
  | { type: "SET_SORT"; field: string }
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_STATE_FILTER"; value: string }
  | { type: "SET_PRIORITY_FILTER"; value: string }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; task: Task }
  | { type: "CLOSE_FORM" }
  | { type: "OPEN_DELETE"; task: Task }
  | { type: "CLOSE_DELETE" }
  | { type: "SET_DELETE_LOADING"; value: boolean }
  | { type: "OPEN_HISTORY"; task: Task }
  | { type: "CLOSE_HISTORY" }
  | { type: "OPEN_PROGRESS"; taskId: string; value: number }
  | { type: "CLOSE_PROGRESS" }
  | { type: "SET_PROGRESS_VALUE"; value: number }
  | { type: "SET_SAVING_PROGRESS"; value: boolean }

const initialState: TasksState = {
  tasks: [],
  isLoading: true,
  fetchKey: 0,
  sortBy: "taskOrder",
  sortOrder: "asc",
  search: "",
  stateFilter: "all",
  priorityFilter: "all",
  formOpen: false,
  editingTask: null,
  deleteOpen: false,
  deletingTask: null,
  deleteLoading: false,
  historyOpen: false,
  historyTask: null,
  progressTaskId: null,
  progressValue: 0,
  savingProgress: false,
}

function reducer(state: TasksState, action: TasksAction): TasksState {
  switch (action.type) {
    case "SET_TASKS":
      return { ...state, tasks: action.tasks, isLoading: false }
    case "UPDATE_TASK_PROGRESS":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? { ...t, version: t.version + 1, progress: action.progress }
            : t
        ),
        progressTaskId: null,
        savingProgress: false,
      }
    case "REFETCH":
      return { ...state, isLoading: true, fetchKey: state.fetchKey + 1 }
    case "SET_SORT":
      if (state.sortBy === action.field) {
        return { ...state, isLoading: true, sortOrder: state.sortOrder === "asc" ? "desc" : "asc" }
      }
      return { ...state, isLoading: true, sortBy: action.field, sortOrder: "asc" }
    case "SET_SEARCH":
      return { ...state, search: action.value }
    case "SET_STATE_FILTER":
      return { ...state, stateFilter: action.value }
    case "SET_PRIORITY_FILTER":
      return { ...state, priorityFilter: action.value }
    case "OPEN_CREATE":
      return { ...state, formOpen: true, editingTask: null }
    case "OPEN_EDIT":
      return { ...state, formOpen: true, editingTask: action.task }
    case "CLOSE_FORM":
      return { ...state, formOpen: false, editingTask: null }
    case "OPEN_DELETE":
      return { ...state, deleteOpen: true, deletingTask: action.task }
    case "CLOSE_DELETE":
      return { ...state, deleteOpen: false, deletingTask: null, deleteLoading: false }
    case "SET_DELETE_LOADING":
      return { ...state, deleteLoading: action.value }
    case "OPEN_HISTORY":
      return { ...state, historyOpen: true, historyTask: action.task }
    case "CLOSE_HISTORY":
      return { ...state, historyOpen: false, historyTask: null }
    case "OPEN_PROGRESS":
      return { ...state, progressTaskId: action.taskId, progressValue: action.value }
    case "CLOSE_PROGRESS":
      return { ...state, progressTaskId: null }
    case "SET_PROGRESS_VALUE":
      return { ...state, progressValue: action.value }
    case "SET_SAVING_PROGRESS":
      return { ...state, savingProgress: action.value }
  }
}

// ── Component ────────────────────────────────────────────────

export function TasksSection({ projectId, projectRole }: TasksSectionProps) {
  const { isAdmin } = useAuthStore()
  const admin = isAdmin()
  const [state, dispatch] = useReducer(reducer, initialState)

  const canManage = admin || projectRole === "DIRECTOR" || projectRole === "MANAGER"

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const params = new URLSearchParams()
      if (state.search) params.set("search", state.search)
      if (state.stateFilter !== "all") params.set("state", state.stateFilter)
      if (state.priorityFilter !== "all") params.set("priority", state.priorityFilter)
      params.set("limit", "50")
      params.set("sortBy", state.sortBy)
      params.set("sortOrder", state.sortOrder)

      const res = await api.get<Task[]>(
        `/api/projects/${projectId}/tasks?${params.toString()}`
      )
      if (cancelled) return
      const paginated = res as CursorPaginatedResult<Task>
      if (paginated.success) {
        dispatch({ type: "SET_TASKS", tasks: paginated.data })
      }
    }

    doFetch()
    return () => { cancelled = true }
  }, [projectId, state.fetchKey, state.search, state.stateFilter, state.priorityFilter, state.sortBy, state.sortOrder])

  const refetch = () => dispatch({ type: "REFETCH" })

  const handleDelete = async () => {
    if (!state.deletingTask) return
    dispatch({ type: "SET_DELETE_LOADING", value: true })
    const res = await api.delete(`/api/projects/${projectId}/tasks/${state.deletingTask.id}`)
    if (res.success) {
      toast.success("Task deleted")
      refetch()
    } else {
      toast.error("Failed to delete task")
    }
    dispatch({ type: "CLOSE_DELETE" })
  }

  const handleProgressSave = async (taskId: string) => {
    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return
    dispatch({ type: "SET_SAVING_PROGRESS", value: true })
    const res = await api.patch(`/api/projects/${projectId}/tasks/${taskId}`, {
      version: task.version,
      progress: state.progressValue,
    })
    if (res.success) {
      toast.success("Progress updated")
      dispatch({ type: "UPDATE_TASK_PROGRESS", taskId, progress: state.progressValue })
    } else {
      toast.error("Failed to update progress")
      dispatch({ type: "SET_SAVING_PROGRESS", value: false })
    }
  }

  const sortIcon = (field: string) => {
    if (state.sortBy !== field) return null
    return state.sortOrder === "asc"
      ? <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
  }

  if (state.isLoading) {
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
        <h2 className="text-lg font-semibold">Tasks ({state.tasks.length})</h2>
        {canManage && (
          <Button
            size="sm"
            onClick={() => dispatch({ type: "OPEN_CREATE" })}
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
            value={state.search}
            onChange={(e) => dispatch({ type: "SET_SEARCH", value: e.target.value })}
          />
        </div>
        <Select value={state.stateFilter} onValueChange={(v) => dispatch({ type: "SET_STATE_FILTER", value: v })}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="WAITING">Waiting</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
            <SelectItem value="CANCELED">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={state.priorityFilter} onValueChange={(v) => dispatch({ type: "SET_PRIORITY_FILTER", value: v })}>
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

      {state.tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 cursor-pointer select-none" onClick={() => dispatch({ type: "SET_SORT", field: "taskOrder" })}>Ord{sortIcon("taskOrder")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => dispatch({ type: "SET_SORT", field: "objective" })}>Objective{sortIcon("objective")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => dispatch({ type: "SET_SORT", field: "priority" })}>Priority{sortIcon("priority")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => dispatch({ type: "SET_SORT", field: "state" })}>State{sortIcon("state")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => dispatch({ type: "SET_SORT", field: "progress" })}>Progress{sortIcon("progress")}</TableHead>
                <TableHead>Owner</TableHead>
                {canManage && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.tasks.map((task) => (
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
                        open={state.progressTaskId === task.id}
                        onOpenChange={(open) => {
                          if (open) {
                            dispatch({ type: "OPEN_PROGRESS", taskId: task.id, value: task.progress })
                          } else {
                            dispatch({ type: "CLOSE_PROGRESS" })
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
                              <span className="text-sm text-muted-foreground">{state.progressValue}%</span>
                            </div>
                            <Slider
                              value={[state.progressValue]}
                              onValueChange={([v]) => dispatch({ type: "SET_PROGRESS_VALUE", value: v })}
                              min={0}
                              max={100}
                              step={5}
                            />
                            <Button
                              size="sm"
                              className="w-full"
                              disabled={state.savingProgress || state.progressValue === task.progress}
                              onClick={() => handleProgressSave(task.id)}
                            >
                              <Check className="mr-2 h-3 w-3" />
                              {state.savingProgress ? "Saving..." : "Save"}
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
                          onClick={() => dispatch({ type: "OPEN_HISTORY", task })}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dispatch({ type: "OPEN_EDIT", task })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => dispatch({ type: "OPEN_DELETE", task })}
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
        open={state.formOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_FORM" })}
        onSuccess={refetch}
        projectId={projectId}
        task={state.editingTask ?? undefined}
      />

      <DeleteConfirmDialog
        open={state.deleteOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_DELETE" })}
        onConfirm={handleDelete}
        title="Delete Task"
        description={
          state.deletingTask
            ? `Delete task "${state.deletingTask.objective}"? This action cannot be undone.`
            : ""
        }
        isLoading={state.deleteLoading}
      />

      <AuditLogDialog
        open={state.historyOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_HISTORY" })}
        tableName="task"
        recordId={state.historyTask?.id ?? ""}
        entityLabel={state.historyTask?.objective ?? "Task"}
        apiBasePath={`/api/projects/${projectId}/audit-log`}
      />
    </div>
  )
}
