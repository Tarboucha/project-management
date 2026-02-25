"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/utils/api-client"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { Plus, UserMinus } from "lucide-react"
import { toast } from "sonner"

interface Member {
  projectId: string
  actorId: string
  role: "DIRECTOR" | "MANAGER" | "CONTRIBUTOR"
  assignedAt: string
  actor: {
    id: string
    firstName: string
    lastName: string
    email: string
    systemRole: string
  }
}

interface ProjectMembersSectionProps {
  projectId: string
  projectRole?: "DIRECTOR" | "MANAGER" | "CONTRIBUTOR"
}

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "DIRECTOR": return "default" as const
    case "MANAGER": return "secondary" as const
    default: return "outline" as const
  }
}

export function ProjectMembersSection({ projectId, projectRole }: ProjectMembersSectionProps) {
  const { isAdmin, actor } = useAuthStore()
  const admin = isAdmin()

  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  // Remove member dialog
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removingMember, setRemovingMember] = useState<Member | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  const canManageMembers = admin || projectRole === "DIRECTOR" || projectRole === "MANAGER"
  const canChangeRoles = admin || projectRole === "DIRECTOR"

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      const res = await api.get<Member[]>(`/api/projects/${projectId}/members`)
      if (cancelled) return
      if (res.success) {
        setMembers(res.data)
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

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = (formData.get("email") as string).trim()
    const role = formData.get("role") as string

    if (!email) {
      toast.error("Email is required")
      return
    }

    setAddLoading(true)
    const res = await api.post(`/api/projects/${projectId}/members`, { email, role })
    if (res.success) {
      toast.success("Member added")
      setAddOpen(false)
      refetch()
    } else {
      toast.error(res.error.message)
    }
    setAddLoading(false)
  }

  const handleRoleChange = async (member: Member, newRole: string) => {
    const res = await api.patch(
      `/api/projects/${projectId}/members/${member.actorId}`,
      { role: newRole }
    )
    if (res.success) {
      toast.success("Role updated")
      refetch()
    } else {
      toast.error(res.error.message)
    }
  }

  const handleRemoveMember = async () => {
    if (!removingMember) return
    setRemoveLoading(true)
    const res = await api.delete(
      `/api/projects/${projectId}/members/${removingMember.actorId}`
    )
    if (res.success) {
      toast.success("Member removed")
      refetch()
    } else {
      toast.error(res.error.message)
    }
    setRemoveLoading(false)
    setRemoveOpen(false)
    setRemovingMember(null)
  }

  const canRemoveMember = (member: Member) => {
    if (admin) return true
    if (projectRole === "DIRECTOR") return true
    if (projectRole === "MANAGER" && member.role === "CONTRIBUTOR") return true
    return false
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
        <h2 className="text-lg font-semibold">Members ({members.length})</h2>
        {canManageMembers && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {canManageMembers && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.actorId}>
                  <TableCell className="font-medium">
                    {member.actor.firstName} {member.actor.lastName}
                    {member.actorId === actor?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.actor.email}</TableCell>
                  <TableCell>
                    {canChangeRoles ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member, v)}
                      >
                        <SelectTrigger className="w-35 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DIRECTOR">Director</SelectItem>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                          <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={roleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(member.assignedAt).toLocaleDateString()}
                  </TableCell>
                  {canManageMembers && (
                    <TableCell>
                      {canRemoveMember(member) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setRemovingMember(member)
                            setRemoveOpen(true)
                          }}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                defaultValue="CONTRIBUTOR"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {(admin || projectRole === "DIRECTOR") && (
                  <>
                    <option value="DIRECTOR">Director</option>
                    <option value="MANAGER">Manager</option>
                  </>
                )}
                <option value="CONTRIBUTOR">Contributor</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={addLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addLoading}>
                {addLoading ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirm */}
      <DeleteConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={handleRemoveMember}
        title="Remove Member"
        description={
          removingMember
            ? `Remove ${removingMember.actor.firstName} ${removingMember.actor.lastName} from this project?`
            : ""
        }
        isLoading={removeLoading}
      />
    </div>
  )
}
