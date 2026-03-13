import { NextRequest, NextResponse } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import { ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { withAnyAuth } from "@/lib/utils/api-route-helper"
import { buildProgramReport } from "@/lib/pdf/program-report"
import type { TDocumentDefinitions } from "pdfmake/interfaces"
import path from "path"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake/js/Printer").default

const noOpUrlResolver = { resolve: () => {}, resolved: () => Promise.resolve() }

type Params = { programId: string }

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
  const printer = new PdfPrinter(fonts, null, noOpUrlResolver)
  const doc = await printer.createPdfKitDocument(docDefinition)

  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
    doc.end()
  })
}

export const GET = withAnyAuth<Params>(async (actor, _request: NextRequest, params) => {
  const { programId } = params!

  const program = await withRLS(actor, async (db) => {
    const prog = await db.program.findUnique({
      where: { id: programId },
    })

    if (!prog || prog.deletedAt) return null

    // Non-admin: verify actor has membership in at least one project under this program
    if (actor.systemRole !== "ADMIN") {
      const membership = await db.projectMember.findFirst({
        where: {
          actorId: actor.id,
          deletedAt: null,
          project: { programId, deletedAt: null },
        },
      })
      if (!membership) return null
    }

    const projects = await db.project.findMany({
      where: { programId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        members: {
          where: { deletedAt: null },
          include: {
            actor: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })

    return { program: prog, projects }
  })

  if (!program) {
    return ApiErrors.notFound("Program")
  }

  const docDefinition = buildProgramReport({
    program: program.program,
    projects: program.projects,
  })

  const buffer = await generatePdfBuffer(docDefinition)

  const safeName = program.program.name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="program-${safeName}-summary.pdf"`,
    },
  })
})

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
