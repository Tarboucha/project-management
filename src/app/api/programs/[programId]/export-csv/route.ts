import { NextRequest, NextResponse } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import { ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { withAnyAuth } from "@/lib/utils/api-route-helper"

type Params = { programId: string }

function escapeField(value: string): string {
  // Always wrap in quotes to safely handle tabs, newlines, and special chars
  return `"${value.replace(/"/g, '""')}"`
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return ""
  return value.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function findMemberByRole(members: Array<{ role: string; actor: { firstName: string; lastName: string } }>, role: string): string {
  const member = members.find((m) => m.role === role)
  return member ? `${member.actor.firstName} ${member.actor.lastName}` : ""
}

export const GET = withAnyAuth<Params>(async (actor, _request: NextRequest, params) => {
  const { programId } = params!

  const result = await withRLS(actor, async (db) => {
    const program = await db.program.findUnique({ where: { id: programId } })
    if (!program || program.deletedAt) return null

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
      orderBy: { projectCode: "asc" },
      include: {
        category: { select: { name: true } },
        activity: { select: { name: true } },
        theme: { select: { name: true } },
        members: {
          where: { deletedAt: null },
          include: { actor: { select: { firstName: true, lastName: true } } },
        },
      },
    })

    return { program, projects }
  })

  if (!result) {
    return ApiErrors.notFound("Program")
  }

  const headers = ["Category", "Activity", "Theme", "Code", "Name", "Objective", "Director", "Manager", "State", "Start Date", "End Date", "Progress"]

  const SEP = "\t"

  const rows = result.projects.map((p) => [
    escapeField(p.category?.name ?? ""),
    escapeField(p.activity?.name ?? ""),
    escapeField(p.theme?.name ?? ""),
    escapeField(p.projectCode ?? ""),
    escapeField(p.name),
    escapeField(p.objective ?? ""),
    escapeField(findMemberByRole(p.members, "DIRECTOR")),
    escapeField(findMemberByRole(p.members, "MANAGER")),
    escapeField(p.state),
    escapeField(formatDate(p.startDate)),
    escapeField(formatDate(p.endDate)),
    `${p.progress}%`,
  ].join(SEP))

  // UTF-8 BOM ensures Excel correctly reads French characters (é, è, ê, etc.)
  const BOM = "\uFEFF"
  const tsv = BOM + [headers.join(SEP), ...rows].join("\n")

  const safeName = result.program.name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")

  return new NextResponse(tsv, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `attachment; filename="program-${safeName}-projects.csv"`,
    },
  })
})

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
