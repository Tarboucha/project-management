"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth-store"
import { api } from "@/lib/utils/api-client"
import { formatDate } from "@/lib/utils/format"
import type { CursorPaginatedResult } from "@/types/api"
import { SummaryCard } from "@/components/pages/dashboard/summary-card"
import { DashboardSkeleton } from "@/components/pages/dashboard/dashboard-skeleton"
import { StateBadge } from "@/components/pages/shared/state-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FolderKanban,
  Briefcase,
  ClipboardList,
  ListTodo,
} from "lucide-react"

interface DashboardTask {
  id: string
  objective: string
  priority: string
  state: string
  progress: number
  startDate: string
  endDate: string | null
  project: { id: string; name: string }
}

interface DashboardTodo {
  id: string
  action: string
  status: string
  todoOrder: number
  deliveryDate: string | null
  comments: string | null
  project: { id: string; name: string }
}

interface DashboardProject {
  id: string
  name: string
  state: "ACTIVE" | "ENDED"
  progress: number
  startDate: string
  endDate: string | null
  program: { id: string; name: string }
  _count: { tasks: number; members: number }
}

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  URGENT: "destructive",
  HIGH: "destructive",
  MEDIUM: "default",
  NORMAL: "secondary",
  LOW: "outline",
}

export default function DashboardPage() {
  const { actor, isLoading: authLoading, isInitialized } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [programCount, setProgramCount] = useState(0)
  const [projectCount, setProjectCount] = useState(0)
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [todos, setTodos] = useState<DashboardTodo[]>([])
  const [projects, setProjects] = useState<DashboardProject[]>([])

  useEffect(() => {
    if (!isInitialized || authLoading || !actor) return
    let cancelled = false

    const fetchAll = async () => {
      setIsLoading(true)

      const [programsRes, projectsRes, tasksRes, todosRes] = await Promise.all([
        api.get<DashboardProject[]>("/api/programs?limit=1&state=ACTIVE"),
        api.get<DashboardProject[]>("/api/projects?limit=10&state=ACTIVE&sortBy=name&sortOrder=asc"),
        api.get<DashboardTask[]>("/api/tasks?limit=10&owner=me&state=ACTIVE"),
        api.get<DashboardTodo[]>("/api/todos?limit=10&responsible=me&status=ACTIVE"),
      ])

      if (cancelled) return

      // Programs — use hasMore to hint there are more than 1
      if (programsRes.success) {
        const p = programsRes as CursorPaginatedResult<DashboardProject>
        setProgramCount(p.hasMore ? p.data.length + 1 : p.data.length)
      }

      // Projects
      if (projectsRes.success) {
        const p = projectsRes as CursorPaginatedResult<DashboardProject>
        setProjectCount(p.hasMore ? p.data.length + 1 : p.data.length)
        setProjects(p.data)
      }

      // Tasks
      if (tasksRes.success) {
        const t = tasksRes as CursorPaginatedResult<DashboardTask>
        setTasks(t.data)
      }

      // Todos
      if (todosRes.success) {
        const t = todosRes as CursorPaginatedResult<DashboardTodo>
        setTodos(t.data)
      }

      setIsLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [isInitialized, authLoading, actor])

  if (!isInitialized || authLoading) {
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Programs"
          value={isLoading ? "..." : `${programCount}`}
          description="Active programs"
          icon={FolderKanban}
        />
        <SummaryCard
          title="Projects"
          value={isLoading ? "..." : `${projectCount}`}
          description="Active projects"
          icon={Briefcase}
        />
        <SummaryCard
          title="My Tasks"
          value={isLoading ? "..." : `${tasks.length}`}
          description="Tasks owned by you"
          icon={ClipboardList}
        />
        <SummaryCard
          title="My To-Dos"
          value={isLoading ? "..." : `${todos.length}`}
          description="To-dos assigned to you"
          icon={ListTodo}
        />
      </div>

      {/* My Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">My Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active tasks assigned to you
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objective</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${task.project.id}/tasks/${task.id}`}
                        className="font-medium hover:underline"
                      >
                        {task.objective}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${task.project.id}`}
                        className="text-muted-foreground hover:underline"
                      >
                        {task.project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANT[task.priority] ?? "secondary"}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={task.progress} className="h-2 w-16" />
                        <span className="text-xs text-muted-foreground">{task.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(task.startDate)}</TableCell>
                    <TableCell>{task.endDate ? formatDate(task.endDate) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* My To-Dos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">My To-Dos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : todos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active to-dos assigned to you
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map((todo) => (
                  <TableRow key={todo.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/projects/${todo.project.id}`}
                        className="hover:underline"
                      >
                        {todo.action}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${todo.project.id}`}
                        className="text-muted-foreground hover:underline"
                      >
                        {todo.project.name}
                      </Link>
                    </TableCell>
                    <TableCell>{todo.deliveryDate ? formatDate(todo.deliveryDate) : "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {todo.comments ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* My Projects */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">My Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active projects
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Tasks</TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="h-2 w-16" />
                        <span className="text-xs text-muted-foreground">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{project._count.members}</TableCell>
                    <TableCell>{project._count.tasks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
