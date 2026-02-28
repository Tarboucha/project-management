"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { DeleteConfirmDialog } from "@/components/pages/shared/delete-confirm-dialog"
import { Check, Plus, UserMinus } from "lucide-react"
import { cn } from "@/lib/utils"
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

interface ActorOption {
  id: string
  firstName: string
  lastName: string
  email: string
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
  const [actors, setActors] = useState<ActorOption[]>([])
  const [actorSearch, setActorSearch] = useState("")
  const [selectedActor, setSelectedActor] = useState<ActorOption | null>(null)
  const [addRole, setAddRole] = useState<string>("CONTRIBUTOR")
  const [actorsLoading, setActorsLoading] = useState(false)
  const [actorsCursor, setActorsCursor] = useState<string | null>(null)
  const [actorsHasMore, setActorsHasMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Remove member dialog
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removingMember, setRemovingMember] = useState<Member | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  const canManageMembers = admin || projectRole === "DIRECTOR" || projectRole === "MANAGER"
  const canChangeRoles = admin || projectRole === "DIRECTOR"

  const fetchActors = useCallback(async (searchTerm: string, cursor?: string | null) => {
    setActorsLoading(true)
    const params = new URLSearchParams()
    params.set("excludeProjectId", projectId)
    params.set("limit", "20")
    if (searchTerm) params.set("search", searchTerm)
    if (cursor) params.set("cursor", cursor)

    const res = await api.get(`/api/actors?${params}`)
    if (res.success) {
      const paginated = res as CursorPaginatedResult<ActorOption>
      if (cursor) {
        setActors((prev) => [...prev, ...paginated.data])
      } else {
        setActors(paginated.data)
      }
      setActorsCursor(paginated.nextCursor)
      setActorsHasMore(paginated.hasMore)
    }
    setActorsLoading(false)
  }, [projectId])

  const loadMoreActors = useCallback(() => {
    if (!actorsHasMore || actorsLoading) return
    fetchActors(actorSearch, actorsCursor)
  }, [actorsHasMore, actorsLoading, actorSearch, actorsCursor, fetchActors])

  useEffect(() => {
    if (!addOpen) return
    setActorSearch("")
    setSelectedActor(null)
    setAddRole("CONTRIBUTOR")
    fetchActors("")
  }, [addOpen, fetchActors])

  useEffect(() => {
    if (!addOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchActors(actorSearch)
    }, actorSearch ? 300 : 0)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [actorSearch, addOpen, fetchActors])

  // Infinite scroll on CommandList
  useEffect(() => {
    const el = listRef.current
    if (!el || !addOpen) return

    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
        loadMoreActors()
      }
    }

    el.addEventListener("scroll", handleScroll)
    return () => el.removeEventListener("scroll", handleScroll)
  }, [addOpen, loadMoreActors])

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

  const handleAddMember = async () => {
    if (!selectedActor) {
      toast.error("Select a user")
      return
    }

    setAddLoading(true)
    const res = await api.post(`/api/projects/${projectId}/members`, {
      email: selectedActor.email,
      role: addRole,
    })
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Select User</Label>
              <div className="rounded-md border">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name or email..."
                    value={actorSearch}
                    onValueChange={setActorSearch}
                  />
                  <CommandList ref={listRef} className="max-h-[240px]">
                    <CommandEmpty>
                      {actorsLoading ? "Loading..." : "No users found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {actors.map((a) => {
                        const isSelected = selectedActor?.id === a.id
                        return (
                          <CommandItem
                            key={a.id}
                            onSelect={() => setSelectedActor(isSelected ? null : a)}
                          >
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible"
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{a.firstName} {a.lastName}</span>
                              <span className="text-xs text-muted-foreground">{a.email}</span>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                    {actorsLoading && actors.length > 0 && (
                      <div className="py-2 text-center text-xs text-muted-foreground">
                        Loading more...
                      </div>
                    )}
                  </CommandList>
                </Command>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(admin || projectRole === "DIRECTOR") && (
                    <>
                      <SelectItem value="DIRECTOR">Director</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                    </>
                  )}
                  <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={addLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleAddMember} disabled={addLoading || !selectedActor}>
                {addLoading ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </div>
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
