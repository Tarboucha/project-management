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
  }
  members: Array<{
    role: string
    actor: { firstName: string; lastName: string; email: string }
  }>
  tasks: Array<{
    taskOrder: number
    objective: string
    details?: string | null
    priority: string
    state: string
    progress: number
    startDate: string | Date
    endDate?: string | Date | null
    owner?: { firstName: string; lastName: string } | null
  }>
  todos: Array<{
    action: string
    todoOrder: number
    status: string
    deliveryDate?: string | Date | null
    comments?: string | null
    responsible?: { firstName: string; lastName: string } | null
  }>
  reviews: Array<{
    reviewDate: string | Date
    notes: string
    createdBy: { firstName: string; lastName: string }
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

function findMemberByRole(members: ProjectReportData["members"], role: string): string {
  const member = members.find((m) => m.role === role)
  return member ? `${member.actor.firstName} ${member.actor.lastName}` : "—"
}

// ============================================================
// TABLE BUILDERS
// ============================================================

const TABLE_HEADER_FILL = "#f3f4f6"

function headerCell(text: string): TableCell {
  return { text, bold: true, fillColor: TABLE_HEADER_FILL, fontSize: 10}
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
          { text: `${m.actor.firstName} ${m.actor.lastName}`, fontSize: 10 },
          { text: m.actor.email, fontSize: 10 },
          { text: m.role, fontSize: 10 },
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
      widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
      body: [
        [headerCell("Ord"), headerCell("Objective"), headerCell("Details"), headerCell("Priority"), headerCell("State"), headerCell("Progress"), headerCell("Start"), headerCell("End"), headerCell("Owner")],
        ...tasks.map((t) => {
          const owner = t.owner ? `${t.owner.firstName} ${t.owner.lastName}` : "—"
          return [
            { text: t.taskOrder.toString(), fontSize: 10, alignment: "center" as const },
            { text: t.objective, fontSize: 10 },
            { text: t.details || "—", fontSize: 10 },
            { text: t.priority, fontSize: 10 },
            { text: t.state, fontSize: 10 },
            { text: `${t.progress}%`, fontSize: 10, alignment: "center" as const },
            { text: formatDate(t.startDate), fontSize: 10 },
            { text: t.endDate ? formatDate(t.endDate) : "—", fontSize: 10 },
            { text: owner, fontSize: 10 },
          ]
        }),
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 10] as [number, number, number, number],
  }
}

function buildTodosTable(todos: ProjectReportData["todos"]): Content {
  if (todos.length === 0) {
    return { text: "No to-dos created.", italics: true, color: "#6b7280", margin: [0, 0, 0, 10] }
  }

  return {
    table: {
      headerRows: 1,
      widths: ["auto", "*", "*", "auto", "auto", "auto"],
      body: [
        [headerCell("Ord"), headerCell("Action"), headerCell("Comments"), headerCell("Status"), headerCell("Delivery"), headerCell("Responsible")],
        ...todos.map((td) => {
          const responsible = td.responsible ? `${td.responsible.firstName} ${td.responsible.lastName}` : "—"
          return [
            { text: td.todoOrder.toString(), fontSize: 10, alignment: "center" as const },
            { text: td.action, fontSize: 10 },
            { text: td.comments || "—", fontSize: 10 },
            { text: td.status, fontSize: 10 },
            { text: td.deliveryDate ? formatDate(td.deliveryDate) : "—", fontSize: 10 },
            { text: responsible, fontSize: 10 },
          ]
        }),
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 10] as [number, number, number, number],
  }
}

function buildReviewsTable(reviews: ProjectReportData["reviews"]): Content {
  if (reviews.length === 0) {
    return { text: "No reviews yet.", italics: true, color: "#6b7280", margin: [0, 0, 0, 10] }
  }

  return {
    table: {
      headerRows: 1,
      widths: ["auto", "*", "auto"],
      body: [
        [headerCell("Date"), headerCell("Notes"), headerCell("By")],
        ...reviews.map((r) => [
          { text: formatDate(r.reviewDate), fontSize: 10 },
          { text: r.notes, fontSize: 10 },
          { text: `${r.createdBy.firstName} ${r.createdBy.lastName}`, fontSize: 10 },
        ]),
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
  const { project, members, tasks, todos, reviews } = data

  const activeTasks = tasks.filter((t) => t.state === "ACTIVE").length
  const completedTasks = tasks.filter((t) => t.state === "ENDED").length

  const projectManager = findMemberByRole(members, "MANAGER")
  const projectDirector = findMemberByRole(members, "DIRECTOR")

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [40, 60, 40, 50],

    header: {
      columns: [
        { text: "PROJECT SUMMARY REPORT", style: "headerText", margin: [40, 20, 0, 0] },
        { text: formatDate(new Date()), alignment: "right", fontSize: 10, color: "#6b7280", margin: [0, 22, 40, 0] },
      ],
    },

    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center" as const,
      fontSize: 10,
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
          { text: [{ text: "Category: ", bold: true }, project.category?.name ?? "—"], fontSize: 10 },
          { text: [{ text: "Activity: ", bold: true }, project.activity?.name ?? "—"], fontSize: 10 },
          { text: [{ text: "Theme: ", bold: true }, project.theme?.name ?? "—"], fontSize: 10 },
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
          { text: [{ text: "Project Manager: ", bold: true }, projectManager], fontSize: 10 },
          { text: [{ text: "Project Director: ", bold: true }, projectDirector], fontSize: 10 },
          { text: [{ text: "Tasks: ", bold: true }, `${activeTasks} active, ${completedTasks} ended (${tasks.length} total)`], fontSize: 10 },
        ],
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },

      // Separator
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 762, y2: 0, lineWidth: 0.5, lineColor: "#d1d5db" }], margin: [0, 0, 0, 15] as [number, number, number, number] },

      // Team Members
      { text: `Team Members (${members.length})`, style: "sectionHeader" },
      buildMembersTable(members),

      // Tasks
      { text: `Tasks (${tasks.length})`, style: "sectionHeader" },
      buildTasksTable(tasks),

      // Todos
      { text: `To-Dos (${todos.length})`, style: "sectionHeader" },
      buildTodosTable(todos),

      // Reviews
      { text: `Reviews (${reviews.length})`, style: "sectionHeader" },
      buildReviewsTable(reviews),
    ],

    styles: {
      headerText: { fontSize: 10, bold: true, color: "#6b7280" },
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 8] },
      sectionHeader: { fontSize: 13, bold: true, margin: [0, 10, 0, 6] },
    },
  }
}
