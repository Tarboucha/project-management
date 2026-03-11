import { NextRequest, NextResponse } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import { ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { buildProjectReport } from "@/lib/pdf/project-report"
import type { TDocumentDefinitions } from "pdfmake/interfaces"
import path from "path"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake/js/Printer").default

type Params = { projectId: string }

const FONTS_DIR = path.join(process.cwd(), "node_modules/pdfmake/build/fonts/Roboto")

const fonts = {
  Roboto: {
    normal: path.join(FONTS_DIR, "Roboto-Regular.ttf"),
    bold: path.join(FONTS_DIR, "Roboto-Medium.ttf"),
    italics: path.join(FONTS_DIR, "Roboto-Italic.ttf"),
    bolditalics: path.join(FONTS_DIR, "Roboto-MediumItalic.ttf"),
  },
}

async function generatePdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  const printer = new PdfPrinter(fonts)
  const doc = await printer.createPdfKitDocument(docDefinition)

  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
    doc.end()
  })
}

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId } = params!

  const project = await withRLS(actor, (db) =>
    db.project.findUnique({
      where: { id: projectId },
      include: {
        program: { select: { name: true } },
        activity: { select: { name: true } },
        theme: { select: { name: true } },
        category: { select: { name: true } },
        members: {
          where: { deletedAt: null },
          include: {
            actor: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        tasks: {
          where: { deletedAt: null },
          orderBy: { taskOrder: "asc" },
          select: {
            taskOrder: true,
            objective: true,
            details: true,
            priority: true,
            state: true,
            progress: true,
            owner: { select: { firstName: true, lastName: true } },
          },
        },
        todos: {
          where: { deletedAt: null },
          orderBy: { todoOrder: "asc" },
          select: {
            action: true,
            todoOrder: true,
            status: true,
            deliveryDate: true,
            comments: true,
            responsible: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })
  )

  if (!project || project.deletedAt) {
    return ApiErrors.notFound("Project")
  }

  const docDefinition = buildProjectReport({
    project,
    members: project.members,
    tasks: project.tasks,
    todos: project.todos,
  })

  const buffer = await generatePdfBuffer(docDefinition)

  const safeName = project.name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="project-${safeName}-summary.pdf"`,
    },
  })
})

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
