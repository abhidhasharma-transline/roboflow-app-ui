import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft,
  Upload,
  Search,
  Users,
  User as UserIcon,
  Zap,
  ChevronRight,
  Lock,
  List as ListIcon,
  LayoutGrid,
  ChevronDown,
  ChevronLeft,
  Tag,
  UserPlus,
  Trash2,
  Pencil,
  Maximize2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollToTopButton } from "@/components/shared/ScrollToTopButton"
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
import { removeImageFromProject } from "@/lib/commentApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
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
  const addToast = useToastStore((s) => s.addToast)

  const [batchName, setBatchName] = useState<string>("")
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [images, setImages] = useState<BatchPreviewImage[]>([])
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  // The real count of unassigned images in the batch — fetchBatchPreview's
  // own `counts.unannotated`, independent of pagination. `images` below is
  // only ever the loaded PAGE of that (pageSize at a time) for browsing/
  // selecting; using images.length as "how many images exist" here would be
  // a real correctness bug, not just a display one — "Assign all unassigned
  // images" sends this number as total_images to the backend
  // (app/jobs/route.py's create_job), which LIMITs its unassigned-images
  // query to it when no explicit image_ids are given. images.length capped
  // at one page would silently create a job with only that page's images
  // instead of everything actually unassigned.
  const [unannotatedTotal, setUnannotatedTotal] = useState(0)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
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
  const [deletingSelected, setDeletingSelected] = useState(false)

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

  async function handleDeleteSelected() {
    if (!workspaceId || !projectId || selectedIds.length === 0 || deletingSelected) return
    setDeletingSelected(true)
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => removeImageFromProject(workspaceId, projectId, id))
      )
      const realFailures = results.filter(
        (r) => r.status === "rejected" && (r.reason as { response?: { status?: number } })?.response?.status !== 404
      )
      if (realFailures.length > 0) {
        addToast({ variant: "error", title: "Couldn't delete some images", description: "Please try again." })
      } else {
        addToast({ variant: "success", title: "Images deleted", description: `${selectedIds.length} image(s)` })
      }
      refetchImages()
      setSelectedIds([])
    } finally {
      setDeletingSelected(false)
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
    fetchBatchPreview(workspaceId, projectId, batchId, { tab: "unannotated", skip: page * pageSize, limit: pageSize }).then((res) => {
      setImages(res.images)
      setBatchName(res.batch_name)
      setUnannotatedTotal(res.counts.unannotated)
    })
  }

  function changePageSize(size: number) {
    setPageSize(size)
    setPage(0)
  }

  const totalAvailable = unannotatedTotal
  const totalPages = Math.max(1, Math.ceil(unannotatedTotal / pageSize))
  const rangeStart = unannotatedTotal === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min(unannotatedTotal, (page + 1) * pageSize)

  const [screen, setScreen] = useState<Screen>("choose")
  const [assignScope, setAssignScope] = useState<"all" | "selected">("all")
  const fieldsRef = useRef<AssignTeamFieldsHandle>(null)

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Batch metadata only fires once per batch — separate from the paginated
  // image fetch below so switching pages doesn't re-fetch these.
  useEffect(() => {
    if (!workspaceId || !projectId || !batchId) return

    getBatch(workspaceId, projectId, batchId)
      .then((b) => setCreatedAt(b.created_at))
      .catch(() => {})

    listTags(workspaceId, projectId).then(setProjectTags).catch(() => {})
  }, [workspaceId, projectId, batchId])

  // Switching batches resets back to page 1 — a stale page number from a
  // previous, larger batch could point past the end of a smaller one.
  useEffect(() => {
    setPage(0)
  }, [batchId])

  useEffect(() => {
    if (!workspaceId || !projectId || !batchId) return
    setImagesLoaded(false)
    fetchBatchPreview(workspaceId, projectId, batchId, { tab: "unannotated", skip: page * pageSize, limit: pageSize }).then((res) => {
      setImages(res.images)
      setBatchName(res.batch_name)
      setUnannotatedTotal(res.counts.unannotated)
      setImagesLoaded(true)
    })
  }, [workspaceId, projectId, batchId, page, pageSize])

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
    <div className="flex h-full flex-1 overflow-hidden">
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Fixed — never scrolls, so the batch name/filters/pagination stay
            put while only the image grid below moves. */}
        <div className="shrink-0 px-8 pt-8">
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
        </div>

        {/* Only this pane scrolls. */}
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-y-auto px-8 pb-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && selectedIds.length > 0) setSelectedIds([])
          }}
        >
        {!imagesLoaded ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading images…</p>
        ) : filteredImages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No images found.</p>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                : "grid grid-cols-1 gap-3 xl:grid-cols-2"
            }
          >
            {filteredImages.map((img, index) => {
              const selected = selectedIds.includes(img.id)
              return viewMode === "grid" ? (
                <div
                  key={img.id}
                  className="group relative flex flex-col gap-1.5 [content-visibility:auto] [contain-intrinsic-size:0_220px]"
                >
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
                    <button
                      title="View full size"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewIndex(index)
                      }}
                      className="absolute right-1.5 bottom-1.5 z-10 flex size-6 items-center justify-center rounded-md bg-background/90 text-foreground opacity-0 shadow-sm hover:bg-accent group-hover:opacity-100"
                    >
                      <Maximize2 className="size-3.5" />
                    </button>
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={img.filename}>
                    {img.filename}
                  </p>
                </div>
              ) : (
                <div
                  key={img.id}
                  onClick={() => toggleSelect(img.id)}
                  className={`flex cursor-pointer items-center gap-4 rounded-md border p-3 [content-visibility:auto] [contain-intrinsic-size:0_92px] ${
                    selected ? "border-brand bg-brand/5" : "border-border"
                  }`}
                >
                  <Checkbox checked={selected} onClick={(e) => e.stopPropagation()} onCheckedChange={() => toggleSelect(img.id)} />
                  <div className="size-14 shrink-0 overflow-hidden rounded bg-muted">
                    {img.thumbnail_url ? (
                      <img src={img.thumbnail_url} alt={img.filename} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                        Processing…
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
                    <p className="truncate text-foreground">
                      <span className="font-semibold text-muted-foreground">FILENAME:</span>{" "}
                      <span title={img.filename}>{img.filename}</span>
                    </p>
                    <p className="flex items-center gap-1 text-foreground">
                      <span className="font-semibold text-muted-foreground">ANNOTATIONS:</span>{" "}
                      {img.annotation_count > 0 ? `${img.annotation_count} Total` : "n/a Total"}
                      <span
                        className="ml-1 flex items-center gap-0.5 italic text-muted-foreground"
                        title={img.class_names.join(", ")}
                      >
                        {img.class_names.length > 0 ? img.class_names.join(", ") : "N/A CLASSES"}
                        <ChevronDown className="size-3" />
                      </span>
                    </p>
                    <p className="text-foreground">
                      <span className="font-semibold text-muted-foreground">TAGS:</span> {img.tags.length} Total
                    </p>
                  </div>
                  <button
                    title="View full size"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewIndex(index)
                    }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Maximize2 className="size-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <ScrollToTopButton containerRef={scrollRef} />
        </div>

        {/* Fixed footer — pagination stays put instead of moving with the grid. */}
        {imagesLoaded && unannotatedTotal > 0 && (
          <div className="shrink-0 flex items-center justify-between border-t border-border px-8 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Per page:</span>
              <Select value={String(pageSize)} onValueChange={(v) => changePageSize(Number(v))}>
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {rangeStart} - {rangeEnd} of {unannotatedTotal}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {imagesLoaded && filteredImages.length > 0 && (
          <div className="shrink-0 mx-8 mb-4 flex items-center gap-3 rounded-lg border border-brand/30 bg-background p-3 shadow-sm">
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
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={selectedIds.length === 0 || deletingSelected}
              onClick={handleDeleteSelected}
            >
              <Trash2 className="size-3.5" />
              {deletingSelected ? "Deleting…" : "Delete Image"}
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

      <Dialog open={previewIndex !== null} onOpenChange={(v) => !v && setPreviewIndex(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-5xl gap-0 border-none bg-transparent p-0 shadow-none"
        >
          {previewIndex !== null && filteredImages[previewIndex] && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm text-white">
                <p className="truncate font-medium">{filteredImages[previewIndex].filename}</p>
                <button
                  onClick={() => setPreviewIndex(null)}
                  className="flex size-7 items-center justify-center rounded-md hover:bg-white/10"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="relative flex items-center justify-center">
                {previewIndex > 0 && (
                  <button
                    onClick={() => setPreviewIndex((i) => (i !== null ? i - 1 : i))}
                    className="absolute left-2 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                )}

                <div className="relative max-h-[80vh] overflow-hidden rounded-lg bg-black">
                  {filteredImages[previewIndex].image_url ? (
                    <img
                      src={filteredImages[previewIndex].image_url ?? undefined}
                      alt={filteredImages[previewIndex].filename}
                      className="max-h-[80vh] max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-64 w-96 items-center justify-center text-sm text-muted-foreground">
                      Preview unavailable
                    </div>
                  )}
                </div>

                {previewIndex < filteredImages.length - 1 && (
                  <button
                    onClick={() => setPreviewIndex((i) => (i !== null ? i + 1 : i))}
                    className="absolute right-2 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                )}
              </div>

              <p className="text-center text-xs text-white/70">
                {previewIndex + 1} of {filteredImages.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
