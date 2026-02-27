import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces"

// ============================================================
// TYPES
// ============================================================

export interface ProjectReportData {
  project: {
    name: string
    projectCode?: string | null
    objective?: string | null
    state: string
    progress: number
    startDate: string | Date
    endDate?: string | Date | null
    budgetEstimated?: unknown
    createdAt: string | Date
    program: { name: string }
    activity?: { name: string } | null
    theme?: { name: string } | null
    category?: { name: string } | null
    createdBy: { firstName: string; lastName: string }
  }
  members: Array<{
    role: string
    actor: { firstName: string; lastName: string; email: string }
  }>
  milestones: Array<{
    name: string
    dueDate: string | Date
    completedAt?: string | Date | null
    _count?: { tasks: number }
  }>
  tasks: Array<{
    objective: string
    priority: string
    state: string
    progress: number
    milestone?: { name: string } | null
    contributors: Array<{
      actor: { firstName: string; lastName: string }
    }>
  }>
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatBudget(value: unknown): string {
  if (value == null) return "—"
  const num = Number(value)
  if (isNaN(num)) return "—"
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} EUR`
}

function milestoneStatus(dueDate: string | Date, completedAt?: string | Date | null): string {
  if (completedAt) return "Completed"
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate
  const now = new Date()
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "Overdue"
  if (diffDays <= 7) return "Due Soon"
  return "On Track"
}

// ============================================================
// TABLE BUILDERS
// ============================================================

const TABLE_HEADER_FILL = "#f3f4f6"

function headerCell(text: string): TableCell {
  return { text, bold: true, fillColor: TABLE_HEADER_FILL, fontSize: 9 }
}

function buildMembersTable(members: ProjectReportData["members"]): Content {
  if (members.length === 0) {
    return { text: "No team members assigned.", italics: true, color: "#6b7280", margin: [0, 0, 0, 10] }
  }

  return {
    table: {
      headerRows: 1,
      widths: ["*", "*", "auto"],
      body: [
        [headerCell("Name"), headerCell("Email"), headerCell("Role")],
        ...members.map((m) => [
          { text: `${m.actor.firstName} ${m.actor.lastName}`, fontSize: 9 },
          { text: m.actor.email, fontSize: 9 },
          { text: m.role, fontSize: 9 },
        ]),
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 10] as [number, number, number, number],
  }
}

function buildMilestonesTable(milestones: ProjectReportData["milestones"]): Content {
  if (milestones.length === 0) {
    return { text: "No milestones defined.", italics: true, color: "#6b7280", margin: [0, 0, 0, 10] }
  }

  return {
    table: {
      headerRows: 1,
      widths: ["*", "auto", "auto", "auto"],
      body: [
        [headerCell("Name"), headerCell("Due Date"), headerCell("Tasks"), headerCell("Status")],
        ...milestones.map((m) => [
          { text: m.name, fontSize: 9 },
          { text: formatDate(m.dueDate), fontSize: 9 },
          { text: String(m._count?.tasks ?? 0), fontSize: 9, alignment: "center" as const },
          { text: milestoneStatus(m.dueDate, m.completedAt), fontSize: 9 },
        ]),
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 10] as [number, number, number, number],
  }
}

function buildTasksTable(tasks: ProjectReportData["tasks"]): Content {
  if (tasks.length === 0) {
    return { text: "No tasks created.", italics: true, color: "#6b7280", margin: [0, 0, 0, 10] }
  }

  return {
    table: {
      headerRows: 1,
      widths: ["*", "auto", "auto", "auto", "auto"],
      body: [
        [headerCell("Objective"), headerCell("Priority"), headerCell("State"), headerCell("Progress"), headerCell("Contributors")],
        ...tasks.map((t) => {
          const contributors = t.contributors
            .map((c) => `${c.actor.firstName} ${c.actor.lastName}`)
            .join(", ") || "—"
          return [
            { text: t.objective, fontSize: 9 },
            { text: t.priority, fontSize: 9 },
            { text: t.state, fontSize: 9 },
            { text: `${t.progress}%`, fontSize: 9, alignment: "center" as const },
            { text: contributors, fontSize: 9 },
          ]
        }),
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 10] as [number, number, number, number],
  }
}

// ============================================================
// MAIN BUILDER
// ============================================================

export function buildProjectReport(data: ProjectReportData): TDocumentDefinitions {
  const { project, members, milestones, tasks } = data

  const activeTasks = tasks.filter((t) => t.state === "ACTIVE").length
  const completedTasks = tasks.filter((t) => t.state === "ENDED").length

  return {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 50],

    header: {
      columns: [
        { text: "PROJECT SUMMARY REPORT", style: "headerText", margin: [40, 20, 0, 0] },
        { text: formatDate(new Date()), alignment: "right", fontSize: 8, color: "#6b7280", margin: [0, 22, 40, 0] },
      ],
    },

    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center" as const,
      fontSize: 8,
      color: "#9ca3af",
      margin: [0, 15, 0, 0] as [number, number, number, number],
    }),

    content: [
      // Project info section
      { text: project.name, style: "title" },
      ...(project.projectCode
        ? [{ text: [{ text: "Code: ", bold: true }, project.projectCode], fontSize: 10, margin: [0, 0, 0, 5] as [number, number, number, number] }]
        : []),
      {
        columns: [
          { text: [{ text: "Program: ", bold: true }, project.program.name], fontSize: 10 },
          { text: [{ text: "State: ", bold: true }, project.state], fontSize: 10, alignment: "right" },
        ],
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      ...(project.objective
        ? [{ text: [{ text: "Objective: ", bold: true }, project.objective], fontSize: 10, margin: [0, 0, 0, 5] as [number, number, number, number] }]
        : []),
      {
        columns: [
          { text: [{ text: "Activity: ", bold: true }, project.activity?.name ?? "—"], fontSize: 10 },
          { text: [{ text: "Theme: ", bold: true }, project.theme?.name ?? "—"], fontSize: 10 },
          { text: [{ text: "Category: ", bold: true }, project.category?.name ?? "—"], fontSize: 10 },
        ],
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      {
        columns: [
          { text: [{ text: "Progress: ", bold: true }, `${project.progress}%`], fontSize: 10 },
          { text: [{ text: "Start: ", bold: true }, formatDate(project.startDate)], fontSize: 10 },
          { text: [{ text: "End: ", bold: true }, project.endDate ? formatDate(project.endDate) : "—"], fontSize: 10 },
          { text: [{ text: "Budget: ", bold: true }, formatBudget(project.budgetEstimated)], fontSize: 10 },
        ],
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      {
        columns: [
          { text: [{ text: "Created by: ", bold: true }, `${project.createdBy.firstName} ${project.createdBy.lastName}`], fontSize: 10 },
          { text: [{ text: "Tasks: ", bold: true }, `${activeTasks} active, ${completedTasks} ended (${tasks.length} total)`], fontSize: 10 },
        ],
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },

      // Separator
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#d1d5db" }], margin: [0, 0, 0, 15] as [number, number, number, number] },

      // Team Members
      { text: `Team Members (${members.length})`, style: "sectionHeader" },
      buildMembersTable(members),

      // Milestones
      { text: `Milestones (${milestones.length})`, style: "sectionHeader" },
      buildMilestonesTable(milestones),

      // Tasks
      { text: `Tasks (${tasks.length})`, style: "sectionHeader" },
      buildTasksTable(tasks),
    ],

    styles: {
      headerText: { fontSize: 8, bold: true, color: "#6b7280" },
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 8] },
      sectionHeader: { fontSize: 13, bold: true, margin: [0, 10, 0, 6] },
    },
  }
}
