import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces"

// ============================================================
// TYPES
// ============================================================

export interface ProgramReportData {
  program: {
    name: string
    description?: string | null
    state: string
    startDate: string | Date
    endDate?: string | Date | null
    budgetEstimated?: unknown
    currency?: string | null
    createdAt: string | Date
  }
  projects: Array<{
    projectCode?: string | null
    name: string
    state: string
    progress: number
    startDate: string | Date
    endDate?: string | Date | null
    members: Array<{
      role: string
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

function formatBudget(value: unknown, currency?: string | null): string {
  if (value == null) return "—"
  const num = Number(value)
  if (isNaN(num)) return "—"
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency ?? "EUR"}`
}

function findMemberByRole(members: ProgramReportData["projects"][number]["members"], role: string): string {
  const member = members.find((m) => m.role === role)
  return member ? `${member.actor.firstName} ${member.actor.lastName}` : "—"
}

// ============================================================
// TABLE BUILDERS
// ============================================================

const TABLE_HEADER_FILL = "#f3f4f6"

function headerCell(text: string): TableCell {
  return { text, bold: true, fillColor: TABLE_HEADER_FILL, fontSize: 10 }
}

function buildProjectsTable(projects: ProgramReportData["projects"]): Content {
  if (projects.length === 0) {
    return { text: "No projects in this program.", italics: true, color: "#6b7280", margin: [0, 0, 0, 10] }
  }

  return {
    table: {
      headerRows: 1,
      widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto", "auto"],
      body: [
        [
          headerCell("Code"),
          headerCell("Name"),
          headerCell("Director"),
          headerCell("Manager"),
          headerCell("Start"),
          headerCell("End"),
          headerCell("State"),
          headerCell("Progress"),
        ],
        ...projects.map((p) => [
          { text: p.projectCode || "—", fontSize: 10, font: "Roboto" },
          { text: p.name, fontSize: 10 },
          { text: findMemberByRole(p.members, "DIRECTOR"), fontSize: 10 },
          { text: findMemberByRole(p.members, "MANAGER"), fontSize: 10 },
          { text: formatDate(p.startDate), fontSize: 10 },
          { text: p.endDate ? formatDate(p.endDate) : "—", fontSize: 10 },
          { text: p.state, fontSize: 10 },
          { text: `${p.progress}%`, fontSize: 10, alignment: "center" as const },
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

export function buildProgramReport(data: ProgramReportData): TDocumentDefinitions {
  const { program, projects } = data

  const activeProjects = projects.filter((p) => p.state === "ACTIVE").length
  const endedProjects = projects.filter((p) => p.state === "ENDED").length

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [40, 60, 40, 50],

    header: {
      columns: [
        { text: "PROGRAM SUMMARY REPORT", style: "headerText", margin: [40, 20, 0, 0] },
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
      // Program info section
      { text: program.name, style: "title" },
      ...(program.description
        ? [{ text: [{ text: "Description: ", bold: true }, program.description], fontSize: 10, margin: [0, 0, 0, 5] as [number, number, number, number] }]
        : []),
      {
        columns: [
          { text: [{ text: "State: ", bold: true }, program.state], fontSize: 10 },
          { text: [{ text: "Projects: ", bold: true }, `${activeProjects} active, ${endedProjects} ended (${projects.length} total)`], fontSize: 10 },
        ],
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      {
        columns: [
          { text: [{ text: "Start: ", bold: true }, formatDate(program.startDate)], fontSize: 10 },
          { text: [{ text: "End: ", bold: true }, program.endDate ? formatDate(program.endDate) : "—"], fontSize: 10 },
          { text: [{ text: "Budget: ", bold: true }, formatBudget(program.budgetEstimated, program.currency)], fontSize: 10 },
        ],
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },

      // Separator
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 762, y2: 0, lineWidth: 0.5, lineColor: "#d1d5db" }], margin: [0, 0, 0, 15] as [number, number, number, number] },

      // Projects
      { text: `Projects (${projects.length})`, style: "sectionHeader" },
      buildProjectsTable(projects),
    ],

    styles: {
      headerText: { fontSize: 10, bold: true, color: "#6b7280" },
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 8] },
      sectionHeader: { fontSize: 13, bold: true, margin: [0, 10, 0, 6] },
    },
  }
}
