import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft,
  Upload,
  Search,
  Users,
  User as UserIcon,
  Zap,
  Building2,
  ChevronRight,
  Lock,
  List as ListIcon,
  LayoutGrid,
  Tag,
  UserPlus,
  Trash2,
  Pencil,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { fetchBatchPreview } from "@/lib/uploadApi"
import { getBatch, createJob, renameBatch } from "@/lib/jobApi"
import { bulkApplyTags, bulkApplyMetadata, listTags, type ImageTag } from "@/lib/tagApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { AssignTeamFields, type AssignTeamFieldsHandle } from "./AssignTeamFields"
import { AddImagesToBatchDialog } from "./AddImagesToBatchDialog"
import type { BatchPreviewImage } from "@/types/upload"

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

  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState("")
  const [tagDraft, setTagDraft] = useState<string[]>([])
  const [metadataPairs, setMetadataPairs] = useState<{ key: string; value: string }[]>([])
  const [metadataKeyDraft, setMetadataKeyDraft] = useState("")
  const [metadataValueDraft, setMetadataValueDraft] = useState("")
  const [applyingTags, setApplyingTags] = useState(false)

  function resetTagDialog() {
    setTagSearch("")
    setTagDraft([])
    setMetadataPairs([])
    setMetadataKeyDraft("")
    setMetadataValueDraft("")
  }

  function toggleTagDraft(name: string) {
    setTagDraft((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  function handleAddNewTag() {
    const name = tagSearch.trim()
    if (!name || tagDraft.includes(name)) return
    setTagDraft((prev) => [...prev, name])
    setTagSearch("")
  }

  function handleAddMetadataPair() {
    const key = metadataKeyDraft.trim()
    const value = metadataValueDraft.trim()
    if (!key || !value) return
    setMetadataPairs((prev) => [...prev.filter((p) => p.key !== key), { key, value }])
    setMetadataKeyDraft("")
    setMetadataValueDraft("")
  }

  function removeMetadataPair(key: string) {
    setMetadataPairs((prev) => prev.filter((p) => p.key !== key))
  }

  async function handleApplyTags() {
    if (!workspaceId || !projectId || selectedIds.length === 0) return
    if (tagDraft.length === 0 && metadataPairs.length === 0) return
    setApplyingTags(true)
    try {
      if (tagDraft.length > 0) {
        await bulkApplyTags(workspaceId, projectId, selectedIds, tagDraft)
      }
      for (const pair of metadataPairs) {
        await bulkApplyMetadata(workspaceId, projectId, selectedIds, pair.key, pair.value)
      }
      setTagDialogOpen(false)
      resetTagDialog()
      refetchImages()
      listTags(workspaceId, projectId).then(setProjectTags).catch(() => {})
    } finally {
      setApplyingTags(false)
    }
  }

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [renameSaving, setRenameSaving] = useState(false)

  const [addImagesOpen, setAddImagesOpen] = useState(false)

  const [projectTags, setProjectTags] = useState<ImageTag[]>([])
  const [tagFilterIds, setTagFilterIds] = useState<string[]>([])

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!workspaceId || !projectId || !batchId || !renameValue.trim()) return
    setRenameSaving(true)
    try {
      const res = await renameBatch(workspaceId, projectId, batchId, renameValue.trim())
      setBatchName(res.name)
      setRenameOpen(false)
    } finally {
      setRenameSaving(false)
    }
  }

  function refetchImages() {
    if (!workspaceId || !projectId || !batchId) return
    fetchBatchPreview(workspaceId, projectId, batchId, { tab: "unannotated" }).then((res) => {
      setImages(res.images)
      setBatchName(res.batch_name)
    })
  }

  const totalAvailable = images.length

  const [screen, setScreen] = useState<Screen>("choose")
  const [assignScope, setAssignScope] = useState<"all" | "selected">("all")
  const fieldsRef = useRef<AssignTeamFieldsHandle>(null)

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId || !projectId || !batchId) return

    fetchBatchPreview(workspaceId, projectId, batchId, { tab: "unannotated" }).then((res) => {
      setImages(res.images)
      setBatchName(res.batch_name)
      setImagesLoaded(true)
    })

    getBatch(workspaceId, projectId, batchId)
      .then((b) => setCreatedAt(b.created_at))
      .catch(() => {})

    listTags(workspaceId, projectId).then(setProjectTags).catch(() => {})
  }, [workspaceId, projectId, batchId])

  const filteredImages = useMemo(() => {
    let result = images
    if (search.trim()) {
      result = result.filter((img) => img.filename.toLowerCase().includes(search.toLowerCase()))
    }
    if (tagFilterIds.length > 0) {
      result = result.filter((img) => img.tags.some((t) => tagFilterIds.includes(t.id)))
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
  }, [images, search, filenameFilter, sortOrder, tagFilterIds])

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

  function toggleTagFilter(tagId: string) {
    setTagFilterIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
  }

  function handleImageCardClick(id: string) {
    if (selectedIds.length > 0) {
      toggleSelect(id)
    }
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
    const payload = fieldsRef.current?.getPayload()
    if (!payload) {
      setError("Select at least one team member.")
      return
    }
    setStarting(true)
    setError(null)
    try {
      const res = await createJob(workspaceId, projectId, batchId, {
        jobType: "team",
        instructions: payload.instructions.trim() || undefined,
        shuffle: payload.shuffle,
        totalImages: payload.totalToAssign,
        assigneeIds: payload.selectedLabelerIds,
        imageIds: payload.imageIds,
      })
      navigate(`/projects/${projectId}/annotate/job/${res.job_id}`)
    } catch {
      setError("Couldn't create the job — try again.")
      setStarting(false)
    }
  }

  function openAssignSelected() {
    if (selectedIds.length === 0) return
    setAssignScope("selected")
    setScreen("team")
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div
        className="flex-1 overflow-y-auto p-8"
        onClick={(e) => {
          if (e.target === e.currentTarget && selectedIds.length > 0) setSelectedIds([])
        }}
      >
        <Link
          to={`/projects/${projectId}/annotate`}
          className="mb-1 flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Annotate
        </Link>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Unassigned Images</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRenameValue(batchName)
                setRenameOpen(true)
              }}
            >
              <Pencil className="size-4" />
              Rename
            </Button>
            <Button variant="outline" onClick={() => setAddImagesOpen(true)}>
              <Upload className="size-4" />
              Upload More
            </Button>
          </div>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-28 justify-between text-sm font-normal">
                Tags{tagFilterIds.length > 0 && ` (${tagFilterIds.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2">
              {projectTags.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No tags yet</p>
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-between px-1">
                    <button
                      className="text-xs font-medium text-brand hover:underline"
                      onClick={() => setTagFilterIds(projectTags.map((t) => t.id))}
                    >
                      Toggle All
                    </button>
                    <button
                      className="text-xs font-medium text-muted-foreground hover:underline"
                      onClick={() => setTagFilterIds([])}
                    >
                      Clear All
                    </button>
                  </div>
                  {projectTags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 rounded px-1 py-1.5 text-sm text-foreground hover:bg-accent"
                    >
                      <Checkbox
                        checked={tagFilterIds.includes(tag.id)}
                        onCheckedChange={() => toggleTagFilter(tag.id)}
                      />
                      {tag.name}
                    </label>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
                    onClick={() => handleImageCardClick(img.id)}
                    className={`relative aspect-[4/3] overflow-hidden rounded-md border bg-muted ${
                      selectedIds.length > 0 ? "cursor-pointer" : ""
                    } ${selected ? "border-brand ring-2 ring-brand/30" : "border-border"}`}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleSelect(img.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1.5 left-1.5 z-10 bg-background/90 shadow-sm data-[state=unchecked]:opacity-0 group-hover:data-[state=unchecked]:opacity-100"
                    />
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
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={() => setTagDialogOpen(true)}
            >
              <Tag className="size-3.5" />
              Add Tags & Metadata
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={openAssignSelected}
            >
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
                onClick={() => {
                  setAssignScope("all")
                  setScreen("team")
                }}
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
            <h2 className="mb-1 text-lg font-semibold text-foreground">
              Assign Images to Team Members
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {assignScope === "selected"
                ? `Assigning your ${selectedIds.length} selected image${selectedIds.length !== 1 ? "s" : ""} only.`
                : `Assigning all ${totalAvailable} unassigned image${totalAvailable !== 1 ? "s" : ""} in this batch.`}
            </p>

            {workspaceId && projectId && (
              <AssignTeamFields
                key={assignScope}
                ref={fieldsRef}
                workspaceId={workspaceId}
                projectId={projectId}
                totalAvailable={assignScope === "selected" ? selectedIds.length : totalAvailable}
                allowTotalEdit={assignScope === "all"}
                imageIds={assignScope === "selected" ? selectedIds : undefined}
              />
            )}

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

      <Dialog
        open={tagDialogOpen}
        onOpenChange={(v) => {
          if (!applyingTags) {
            setTagDialogOpen(v)
            if (!v) resetTagDialog()
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4" />
              Apply Tags & Metadata
            </DialogTitle>
          </DialogHeader>

          <Input
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddNewTag()
              }
            }}
            placeholder="Search existing tags or add a new tag…"
            autoFocus
          />
          <p className="-mt-2 text-xs text-muted-foreground">Click a tag to select it.</p>

          <div className="flex flex-wrap gap-1.5">
            {projectTags
              .filter((t) => t.name.toLowerCase().includes(tagSearch.trim().toLowerCase()))
              .map((t) => {
                const selected = tagDraft.includes(t.name)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTagDraft(t.name)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-foreground hover:bg-accent"
                    }`}
                  >
                    {t.name}
                  </button>
                )
              })}
            {tagDraft
              .filter((name) => !projectTags.some((t) => t.name === name))
              .map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleTagDraft(name)}
                  className="rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground"
                >
                  {name} (new)
                </button>
              ))}
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Metadata</p>
            <div className="flex gap-2">
              <Input
                value={metadataKeyDraft}
                onChange={(e) => setMetadataKeyDraft(e.target.value)}
                placeholder="Key"
                className="text-sm"
              />
              <Input
                value={metadataValueDraft}
                onChange={(e) => setMetadataValueDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddMetadataPair()
                  }
                }}
                placeholder="Value"
                className="text-sm"
              />
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={handleAddMetadataPair}
                disabled={!metadataKeyDraft.trim() || !metadataValueDraft.trim()}
              >
                + Add
              </Button>
            </div>
            {metadataPairs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {metadataPairs.map((p) => (
                  <span
                    key={p.key}
                    className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {p.key}: {p.value}
                    <button type="button" onClick={() => removeMetadataPair(p.key)} className="text-muted-foreground hover:text-foreground">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={handleApplyTags}
              disabled={applyingTags || (tagDraft.length === 0 && metadataPairs.length === 0)}
            >
              {applyingTags ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={renameSaving ? undefined : setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename batch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={renameSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={renameSaving || !renameValue.trim()}>
                {renameSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {workspaceId && projectId && batchId && (
        <AddImagesToBatchDialog
          workspaceId={workspaceId}
          projectId={projectId}
          batchId={batchId}
          open={addImagesOpen}
          onOpenChange={setAddImagesOpen}
          onUploaded={refetchImages}
        />
      )}
    </div>
  )
}
