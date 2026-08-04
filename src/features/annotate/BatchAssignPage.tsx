import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft,
  Upload,
  Search,
  Users,
  User as UserIcon,
  Plus,
  Zap,
  Building2,
  ChevronRight,
  Lock,
  List as ListIcon,
  LayoutGrid,
  Tag,
  UserPlus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { fetchBatchPreview } from "@/lib/uploadApi"
import { getBatch, createJob } from "@/lib/jobApi"
import { listProjectMembers, addProjectMember } from "@/lib/projectApi"
import { listWorkspaceMembers, listWorkspaceInvitations } from "@/lib/workspaceApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { fullName, initials } from "@/lib/userDisplay"
import type { BatchPreviewImage } from "@/types/upload"
import type { ProjectMember } from "@/types/project"
import type { WorkspaceMember, WorkspaceInvitation } from "@/types/workspace"

type Screen = "choose" | "team"

function OptionCard({
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant = "brand",
  disabled,
  showChevron,
  onClick,
}: {
  icon: typeof Zap
  title: string
  description: string
  badge?: string
  badgeVariant?: "brand" | "upgrade"
  disabled?: boolean
  showChevron?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        disabled
          ? "cursor-not-allowed border-border opacity-60"
          : "border-border hover:border-brand/40 hover:bg-brand/5"
      }`}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        {disabled ? <Lock className="size-4" /> : <Icon className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                badgeVariant === "upgrade" ? "bg-amber-100 text-amber-800" : "bg-brand/15 text-brand"
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {showChevron && !disabled && (
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}

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

export function BatchAssignPage() {
  const { projectId, batchId } = useParams<{ projectId: string; batchId: string }>()
  const navigate = useNavigate()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)

  const [batchName, setBatchName] = useState<string>("")
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [images, setImages] = useState<BatchPreviewImage[]>([])
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [search, setSearch] = useState("")
  const [filenameFilter, setFilenameFilter] = useState("")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const totalAvailable = images.length

  const [screen, setScreen] = useState<Screen>("choose")
  const [totalToAssign, setTotalToAssign] = useState(0)
  const [shuffle, setShuffle] = useState(true)
  const [instructions, setInstructions] = useState("")
  const [instructionsOpen, setInstructionsOpen] = useState(false)

  const [labelers, setLabelers] = useState<ProjectMember[]>([])
  const [selectedLabelerIds, setSelectedLabelerIds] = useState<string[]>([])
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvitation[]>([])
  const [memberSearch, setMemberSearch] = useState("")

  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId || !projectId || !batchId) return

    fetchBatchPreview(workspaceId, projectId, batchId, { tab: "unannotated" }).then((res) => {
      setImages(res.images)
      setBatchName(res.batch_name)
      setTotalToAssign(res.images.length)
      setImagesLoaded(true)
    })

    getBatch(workspaceId, projectId, batchId)
      .then((b) => setCreatedAt(b.created_at))
      .catch(() => {})

    listProjectMembers(workspaceId, projectId, "labeler")
      .then((rows) => {
        setLabelers(rows)
        setSelectedLabelerIds(rows.map((m) => m.user_id))
      })
      .catch(() => {})

    listWorkspaceInvitations(workspaceId).then(setPendingInvites).catch(() => {})
  }, [workspaceId, projectId, batchId])

  const filteredImages = useMemo(() => {
    let result = images
    if (search.trim()) {
      result = result.filter((img) => img.filename.toLowerCase().includes(search.toLowerCase()))
    }
    if (filenameFilter.trim()) {
      result = result.filter((img) =>
        img.filename.toLowerCase().includes(filenameFilter.toLowerCase())
      )
    }
    if (sortOrder === "oldest") {
      result = [...result].reverse()
    }
    return result
  }, [images, search, filenameFilter, sortOrder])

  const allVisibleSelected =
    filteredImages.length > 0 && filteredImages.every((img) => selectedIds.includes(img.id))

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredImages.some((img) => img.id === id)))
    } else {
      setSelectedIds((prev) => [
        ...prev,
        ...filteredImages.map((img) => img.id).filter((id) => !prev.includes(id)),
      ])
    }
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

  function toggleLabeler(userId: string) {
    setSelectedLabelerIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  function clampTotal(n: number) {
    return Math.max(1, Math.min(totalAvailable || 1, n || 1))
  }

  async function handleLabelManually() {
    if (!workspaceId || !projectId || !batchId) return
    setStarting(true)
    setError(null)
    try {
      const res = await createJob(workspaceId, projectId, batchId, {
        jobType: "self",
        shuffle: false,
        totalImages: totalAvailable,
        assigneeIds: [],
      })
      navigate(`/projects/${projectId}/annotate/job/${res.job_id}`)
    } catch {
      setError("Couldn't create the job — try again.")
      setStarting(false)
    }
  }

  async function handleStartTeam() {
    if (!workspaceId || !projectId || !batchId) return
    if (selectedLabelerIds.length === 0) {
      setError("Select at least one team member.")
      return
    }
    setStarting(true)
    setError(null)
    try {
      const res = await createJob(workspaceId, projectId, batchId, {
        jobType: "team",
        instructions: instructions.trim() || undefined,
        shuffle,
        totalImages: totalToAssign,
        assigneeIds: selectedLabelerIds,
      })
      navigate(`/projects/${projectId}/annotate/job/${res.job_id}`)
    } catch {
      setError("Couldn't create the job — try again.")
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <Link
          to={`/projects/${projectId}/annotate`}
          className="mb-1 flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Annotate
        </Link>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Unassigned Images</h1>
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}/upload`}>
              <Upload className="size-4" />
              Upload More
            </Link>
          </Button>
        </div>
        <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1">Batch: {batchName || "Loading…"}</span>
          {createdAt && (
            <span className="rounded-full bg-muted px-2.5 py-1">
              Uploaded{" "}
              {new Date(createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        <div className="relative mb-3 w-80">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search images"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Filter by filename"
            className="h-9 w-48 text-sm"
            value={filenameFilter}
            onChange={(e) => setFilenameFilter(e.target.value)}
          />
          <Select disabled>
            <SelectTrigger className="h-9 w-28 text-sm">
              <SelectValue placeholder="Split" />
            </SelectTrigger>
            <SelectContent />
          </Select>
          <Select disabled>
            <SelectTrigger className="h-9 w-28 text-sm">
              <SelectValue placeholder="Classes" />
            </SelectTrigger>
            <SelectContent />
          </Select>
          <Select disabled>
            <SelectTrigger className="h-9 w-28 text-sm">
              <SelectValue placeholder="Tags" />
            </SelectTrigger>
            <SelectContent />
          </Select>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Sort By</span>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="ml-1 flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={showAnnotations} onCheckedChange={(v) => setShowAnnotations(v === true)} />
            Show Annotations
          </label>
          <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`rounded p-1.5 ${viewMode === "list" ? "bg-muted" : "text-muted-foreground"}`}
              title="List view"
            >
              <ListIcon className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded p-1.5 ${
                viewMode === "grid" ? "bg-brand text-brand-foreground" : "text-muted-foreground"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>

        {!imagesLoaded ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading images…</p>
        ) : filteredImages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No images found.</p>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                : "flex flex-col gap-2"
            }
          >
            {filteredImages.map((img) => {
              const selected = selectedIds.includes(img.id)
              return viewMode === "grid" ? (
                <div key={img.id} className="group relative flex flex-col gap-1.5">
                  <div
                    className={`relative aspect-[4/3] overflow-hidden rounded-md border bg-muted ${
                      selected ? "border-brand ring-2 ring-brand/30" : "border-border"
                    }`}
                  >
                    <button
                      onClick={() => toggleSelect(img.id)}
                      className="absolute top-1.5 left-1.5 z-10"
                    >
                      <Checkbox
                        checked={selected}
                        className="bg-background/90 shadow-sm data-[state=unchecked]:opacity-0 group-hover:data-[state=unchecked]:opacity-100"
                      />
                    </button>
                    {img.thumbnail_url ? (
                      <img src={img.thumbnail_url} alt={img.filename} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        Processing…
                      </div>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={img.filename}>
                    {img.filename}
                  </p>
                </div>
              ) : (
                <div
                  key={img.id}
                  onClick={() => toggleSelect(img.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 ${
                    selected ? "border-brand bg-brand/5" : "border-border"
                  }`}
                >
                  <Checkbox checked={selected} />
                  <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">
                    {img.thumbnail_url && (
                      <img src={img.thumbnail_url} alt={img.filename} className="size-full object-cover" />
                    )}
                  </div>
                  <p className="truncate text-sm text-foreground">{img.filename}</p>
                </div>
              )
            })}
          </div>
        )}

        {imagesLoaded && filteredImages.length > 0 && (
          <div className="sticky bottom-0 mt-6 flex items-center gap-3 rounded-lg border border-brand/30 bg-background p-3 shadow-sm">
            <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} />
            <span className="text-sm text-foreground">{selectedIds.length} images selected</span>
            <Button variant="outline" size="sm" disabled={selectedIds.length === 0}>
              <Tag className="size-3.5" />
              Add Tags & Metadata
            </Button>
            <Button variant="outline" size="sm" disabled={selectedIds.length === 0}>
              <UserPlus className="size-3.5" />
              Assign for Labeling
            </Button>
            <Button variant="outline" size="sm" disabled={selectedIds.length === 0}>
              <Trash2 className="size-3.5" />
              Delete Image
            </Button>
          </div>
        )}
      </div>

      <div className="flex w-[420px] shrink-0 flex-col overflow-y-auto border-l border-border p-6">
        {screen === "choose" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Choose how to label your images
            </h2>
            <div className="flex flex-col gap-3">
              <OptionCard
                icon={Zap}
                title="Auto-Label And Review"
                description="Create a first pass across the batch, then review or edit anything before adding it."
                badge="Fastest"
                disabled
              />
              <OptionCard
                icon={UserIcon}
                title="Label Manually"
                description={starting ? "Creating job…" : "Create each label yourself, one image at a time."}
                onClick={handleLabelManually}
                disabled={starting}
              />
              <OptionCard
                icon={Users}
                title="Label With My Team"
                description="Split up the labeling work across your team."
                showChevron
                onClick={() => setScreen("team")}
              />
              <OptionCard
                icon={Building2}
                title="Hire Outsourced Labelers"
                description="Work with a professional labeling team."
                badge="Upgrade"
                badgeVariant="upgrade"
                disabled
              />
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </>
        )}

        {screen === "team" && (
          <>
            <button
              onClick={() => setScreen("choose")}
              className="mb-3 flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Assign Images to Team Members
            </h2>

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

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setScreen("choose")}>
                Back
              </Button>
              <Button variant="brand" className="flex-1" onClick={handleStartTeam} disabled={starting}>
                {starting ? "Starting…" : "Start Annotating"}
              </Button>
            </div>
          </>
        )}
      </div>

      {workspaceId && projectId && (
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
      )}
    </div>
  )
}
