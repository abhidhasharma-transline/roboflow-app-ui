import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { listProjectMembers, addProjectMember } from "@/lib/projectApi"
import { listWorkspaceMembers, listWorkspaceInvitations } from "@/lib/workspaceApi"
import { fullName, initials } from "@/lib/userDisplay"
import type { ProjectMember } from "@/types/project"
import type { WorkspaceMember, WorkspaceInvitation } from "@/types/workspace"

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-foreground">{children}</p>
}

function AddTeamMemberDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  existingLabelerIds,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  projectId: string
  existingLabelerIds: string[]
  onAdded: () => void
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [search, setSearch] = useState("")
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listWorkspaceMembers(workspaceId).then(setMembers)
  }, [open, workspaceId])

  const candidates = members.filter(
    (m) =>
      !existingLabelerIds.includes(m.user_id) &&
      `${fullName(m)} ${m.email}`.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd(userId: string) {
    setAddingId(userId)
    try {
      await addProjectMember(workspaceId, projectId, userId, "labeler")
      onAdded()
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team members</DialogTitle>
          <DialogDescription>
            Anyone in your workspace can be added as a labeler for this project.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search workspace members…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No matching members.</p>
          ) : (
            candidates.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="bg-brand/15 text-xs text-brand">
                    {initials(m)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fullName(m)}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd(m.user_id)}
                  disabled={addingId === m.user_id}
                >
                  {addingId === m.user_id ? "Adding…" : "Add"}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export interface AssignTeamFieldsPayload {
  selectedLabelerIds: string[]
  totalToAssign: number
  shuffle: boolean
  instructions: string
}

export interface AssignTeamFieldsHandle {
  getPayload: () => AssignTeamFieldsPayload | null
}

interface AssignTeamFieldsProps {
  workspaceId: string
  projectId: string
  totalAvailable: number
  allowTotalEdit?: boolean
  initialTotalToAssign?: number
  initialShuffle?: boolean
  initialInstructions?: string
  initialSelectedLabelerIds?: string[]
}

export const AssignTeamFields = forwardRef<AssignTeamFieldsHandle, AssignTeamFieldsProps>(
  function AssignTeamFields(
    {
      workspaceId,
      projectId,
      totalAvailable,
      allowTotalEdit = true,
      initialTotalToAssign,
      initialShuffle = true,
      initialInstructions = "",
      initialSelectedLabelerIds,
    },
    ref
  ) {
    const [totalToAssign, setTotalToAssign] = useState(initialTotalToAssign ?? totalAvailable)
    const [shuffle, setShuffle] = useState(initialShuffle)
    const [instructions, setInstructions] = useState(initialInstructions)
    const [instructionsOpen, setInstructionsOpen] = useState(Boolean(initialInstructions))

    const [labelers, setLabelers] = useState<ProjectMember[]>([])
    const [selectedLabelerIds, setSelectedLabelerIds] = useState<string[]>(
      initialSelectedLabelerIds ?? []
    )
    const [pendingInvites, setPendingInvites] = useState<WorkspaceInvitation[]>([])
    const [memberSearch, setMemberSearch] = useState("")
    const [addMemberOpen, setAddMemberOpen] = useState(false)

    useEffect(() => {
      listProjectMembers(workspaceId, projectId, "labeler")
        .then((rows) => {
          setLabelers(rows)
          setSelectedLabelerIds(initialSelectedLabelerIds ?? rows.map((m) => m.user_id))
        })
        .catch(() => {})

      listWorkspaceInvitations(workspaceId).then(setPendingInvites).catch(() => {})
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, projectId])

    function clampTotal(n: number) {
      return Math.max(1, Math.min(totalAvailable || 1, n || 1))
    }

    function toggleLabeler(userId: string) {
      setSelectedLabelerIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      )
    }

    const filteredLabelers = useMemo(
      () =>
        memberSearch.trim()
          ? labelers.filter((m) =>
              `${fullName(m)} ${m.email}`.toLowerCase().includes(memberSearch.toLowerCase())
            )
          : labelers,
      [labelers, memberSearch]
    )

    const distribution = useMemo(() => {
      const counts: Record<string, number> = {}
      if (selectedLabelerIds.length === 0) return counts
      for (let i = 0; i < totalToAssign; i++) {
        const uid = selectedLabelerIds[i % selectedLabelerIds.length]
        counts[uid] = (counts[uid] ?? 0) + 1
      }
      return counts
    }, [selectedLabelerIds, totalToAssign])

    useImperativeHandle(ref, () => ({
      getPayload() {
        if (selectedLabelerIds.length === 0) return null
        return { selectedLabelerIds, totalToAssign, shuffle, instructions }
      },
    }))

    return (
      <>
        {allowTotalEdit ? (
          <div className="mb-5">
            <Label>Total Images to Assign</Label>
            <div className="mt-1.5 flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={totalAvailable}
                value={totalToAssign}
                onChange={(e) => setTotalToAssign(clampTotal(Number(e.target.value)))}
                className="h-9 w-20"
              />
              <span className="text-sm text-muted-foreground">/ {totalAvailable}</span>
            </div>
            <input
              type="range"
              min={1}
              max={Math.max(1, totalAvailable)}
              value={totalToAssign}
              onChange={(e) => setTotalToAssign(clampTotal(Number(e.target.value)))}
              className="mt-2 w-full accent-brand"
            />
          </div>
        ) : (
          <p className="mb-5 text-sm text-muted-foreground">
            {totalAvailable} image{totalAvailable !== 1 && "s"} in this job
          </p>
        )}

        <label className="mb-4 flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={shuffle} onCheckedChange={(v) => setShuffle(v === true)} />
          Shuffle images when assigning
        </label>

        <div className="mb-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setInstructionsOpen((v) => !v)}
          >
            {instructions ? "Edit Instructions" : "Add Instructions"}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setAddMemberOpen(true)}>
            <Plus className="size-3.5" />
            Add Team Members
          </Button>
        </div>

        {instructionsOpen && (
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions for labelers…"
            className="mb-4 min-h-20 w-full rounded-md border border-border p-2.5 text-sm"
          />
        )}

        <div className="relative mb-3">
          <Search className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search for team members…"
            className="h-9 pl-8 text-sm"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          {filteredLabelers.map((m) => {
            const selected = selectedLabelerIds.includes(m.user_id)
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => toggleLabeler(m.user_id)}
                className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                  selected ? "border-brand bg-brand/5" : "border-border hover:bg-accent"
                }`}
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-brand/15 text-xs text-brand">
                    {initials(m)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{fullName(m)}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                {selected && (
                  <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-brand-foreground">
                    {distribution[m.user_id] ?? 0} images
                  </span>
                )}
              </button>
            )
          })}

          {pendingInvites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 rounded-lg border border-border p-2.5 opacity-60"
            >
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                  {inv.email.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">{inv.email}</p>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Invited
              </span>
            </div>
          ))}

          {filteredLabelers.length === 0 && pendingInvites.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No labelers on this project yet — add one above.
            </p>
          )}
        </div>

        <AddTeamMemberDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          workspaceId={workspaceId}
          projectId={projectId}
          existingLabelerIds={labelers.map((m) => m.user_id)}
          onAdded={() =>
            listProjectMembers(workspaceId, projectId, "labeler").then((rows) => {
              setLabelers(rows)
              setSelectedLabelerIds((prev) => [
                ...prev,
                ...rows.map((m) => m.user_id).filter((id) => !prev.includes(id)),
              ])
            })
          }
        />
      </>
    )
  }
)
