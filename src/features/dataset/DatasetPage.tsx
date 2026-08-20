import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import {
  Search,
  Eye,
  EyeOff,
  Trash2,
  Tag as TagIcon,
  SplitSquareHorizontal,
  Zap,
  Database,
  UserPlus,
  Ban,
  Download,
  List as ListIcon,
  LayoutGrid,
  Activity,
  ShieldCheck,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { TagInput } from "@/components/shared/TagInput"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
import { useProject } from "@/hooks/useProjects"
import { listProjectImages, bulkSetSplit, markImagesNull, type ProjectImageSummary } from "@/lib/imageApi"
import { removeImageFromProject } from "@/lib/commentApi"
import { listClasses, type ProjectClass } from "@/lib/classApi"
import { listTags, bulkApplyTags, bulkApplyMetadata, type ImageTag } from "@/lib/tagApi"
import { AssignForLabelingPanel } from "./AssignForLabelingPanel"
import { ExportDatasetDialog } from "./ExportDatasetDialog"

const PAGE_SIZE = 50

function AnnotationOverlay({ img }: { img: ProjectImageSummary }) {
  if (img.annotations.length === 0) return null
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {img.annotations.map((a, i) =>
        a.shape_type === "bbox" ? (
          <rect
            key={i}
            x={a.geometry.x as number}
            y={a.geometry.y as number}
            width={a.geometry.width as number}
            height={a.geometry.height as number}
            fill="none"
            stroke={a.class_color}
            strokeWidth={0.8}
          />
        ) : (
          <polygon
            key={i}
            points={((a.geometry.points as { x: number; y: number }[]) ?? [])
              .map((p) => `${p.x},${p.y}`)
              .join(" ")}
            fill="none"
            stroke={a.class_color}
            strokeWidth={0.8}
          />
        )
      )}
    </svg>
  )
}

const SPLIT_BADGE: Record<string, { label: string; className: string; icon: typeof Activity }> = {
  train: { label: "Train", className: "bg-brand text-brand-foreground", icon: Activity },
  valid: { label: "Valid", className: "bg-blue-500 text-white", icon: ShieldCheck },
  test: { label: "Test", className: "bg-orange-500 text-white", icon: Pencil },
}

function SplitBadge({ split }: { split: string | null }) {
  const badge = split ? SPLIT_BADGE[split] : null
  if (!badge) return null
  const Icon = badge.icon
  return (
    <span
      className={`absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm ${badge.className}`}
    >
      <Icon className="size-2.5" />
      {badge.label}
    </span>
  )
}

function NullBadge() {
  return (
    <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
      <Ban className="size-2.5" />
      Null
    </span>
  )
}

export function DatasetPage() {
  const { projectId } = useParams()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const addToast = useToastStore((s) => s.addToast)
  const { project } = useProject(projectId)

  const [images, setImages] = useState<ProjectImageSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [splitFilter, setSplitFilter] = useState("all")
  const [classFilter, setClassFilter] = useState("all")
  const [tagFilter, setTagFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([])

  const [classes, setClasses] = useState<ProjectClass[]>([])
  const [tags, setTags] = useState<ImageTag[]>([])

  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState<string[]>([])
  const [metadataKeyDraft, setMetadataKeyDraft] = useState("")
  const [metadataValueDraft, setMetadataValueDraft] = useState("")
  const [metadataPairs, setMetadataPairs] = useState<{ key: string; value: string }[]>([])
  const [applyingTags, setApplyingTags] = useState(false)

  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [applyingSplit, setApplyingSplit] = useState(false)

  const [assignPanelOpen, setAssignPanelOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const [deletingSelected, setDeletingSelected] = useState(false)
  const [markingNull, setMarkingNull] = useState(false)

  function refetch() {
    if (!workspaceId || !projectId) return
    setLoading(true)
    listProjectImages(workspaceId, projectId, {
      status: "dataset",
      split: splitFilter === "all" ? undefined : splitFilter,
      classId: classFilter === "all" ? undefined : classFilter,
      tagId: tagFilter === "all" ? undefined : tagFilter,
      search,
      sort: sortOrder,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        setImages(res.items)
        setTotal(res.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refetch, [workspaceId, projectId, splitFilter, classFilter, tagFilter, search, sortOrder, page])
  useEffect(() => setPage(0), [splitFilter, classFilter, tagFilter, search])

  useEffect(() => {
    if (!workspaceId || !projectId) return
    listClasses(workspaceId, projectId).then(setClasses)
    listTags(workspaceId, projectId).then(setTags)
  }, [workspaceId, projectId])

  const splitCounts = useMemo(() => {
    const counts = { train: 0, valid: 0, test: 0 }
    for (const img of images) {
      if (selectedIds.includes(img.id) && img.split) counts[img.split]++
    }
    return counts
  }, [images, selectedIds])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleExpandedRow(id: string) {
    setExpandedRowIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allVisibleSelected = images.length > 0 && images.every((img) => selectedIds.includes(img.id))

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !images.some((img) => img.id === id)))
    } else {
      setSelectedIds((prev) => [...prev, ...images.map((img) => img.id).filter((id) => !prev.includes(id))])
    }
  }

  function resetTagDialog() {
    setTagDraft([])
    setMetadataPairs([])
    setMetadataKeyDraft("")
    setMetadataValueDraft("")
  }

  function handleAddMetadataPair() {
    const key = metadataKeyDraft.trim()
    const value = metadataValueDraft.trim()
    if (!key || !value) return
    setMetadataPairs((prev) => [...prev.filter((p) => p.key !== key), { key, value }])
    setMetadataKeyDraft("")
    setMetadataValueDraft("")
  }

  async function handleApplyTags() {
    if (!workspaceId || !projectId) return
    if (tagDraft.length === 0 && metadataPairs.length === 0) return
    setApplyingTags(true)
    try {
      if (tagDraft.length > 0) {
        await bulkApplyTags(workspaceId, projectId, selectedIds, tagDraft)
      }
      for (const pair of metadataPairs) {
        await bulkApplyMetadata(workspaceId, projectId, selectedIds, pair.key, pair.value)
      }
      addToast({ variant: "success", title: "Applied", description: `${selectedIds.length} image(s) updated` })
      setTagDialogOpen(false)
      resetTagDialog()
    } catch {
      addToast({ variant: "error", title: "Couldn't apply changes", description: "Please try again." })
    } finally {
      setApplyingTags(false)
    }
  }

  async function handleSetAllSplit(split: "train" | "valid" | "test") {
    if (!workspaceId || !projectId) return
    setApplyingSplit(true)
    try {
      await bulkSetSplit(workspaceId, projectId, selectedIds, split)
      addToast({ variant: "success", title: "Split updated", description: `${selectedIds.length} image(s) → ${split}` })
      setSplitDialogOpen(false)
      setSelectedIds([])
      refetch()
    } catch {
      addToast({ variant: "error", title: "Couldn't update split", description: "Please try again." })
    } finally {
      setApplyingSplit(false)
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
      setImages((prev) => prev.filter((img) => !selectedIds.includes(img.id)))
      setTotal((prev) => Math.max(0, prev - selectedIds.length))
      setSelectedIds([])
    } finally {
      setDeletingSelected(false)
    }
  }

  async function handleMarkNull() {
    if (!workspaceId || !projectId || selectedIds.length === 0 || markingNull) return
    setMarkingNull(true)
    try {
      const res = await markImagesNull(workspaceId, projectId, selectedIds)
      addToast({
        variant: "success",
        title: "Marked as null",
        description: `${res.marked_null} image(s) · ${res.annotations_removed} annotation(s) cleared`,
      })
      setSelectedIds([])
      refetch()
    } catch {
      addToast({ variant: "error", title: "Couldn't mark images null", description: "Please try again." })
    } finally {
      setMarkingNull(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-foreground">
              <Database className="size-6" />
              Dataset
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{total} image{total !== 1 && "s"} ready for training</p>
          </div>
          <Button variant="brand" disabled title="Coming soon — no training pipeline wired up yet">
            <Zap className="size-4" />
            Train Model
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by filename…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={splitFilter} onValueChange={setSplitFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Split" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Splits</SelectItem>
              <SelectItem value="train">Train</SelectItem>
              <SelectItem value="valid">Valid</SelectItem>
              <SelectItem value="test">Test</SelectItem>
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Tags" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Sort By</span>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnnotations((v) => !v)}
            title="Toggle annotation overlay"
          >
            {showAnnotations ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            Show Annotations
          </Button>
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

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : images.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No images in the dataset yet — add annotated images to it from the Annotate page.
          </p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {images.map((img) => {
              const selected = selectedIds.includes(img.id)
              return (
                <div key={img.id} className="group relative flex flex-col gap-1.5">
                  <div
                    onClick={() => toggleSelect(img.id)}
                    className={`relative aspect-[4/3] cursor-pointer overflow-hidden rounded-md border bg-muted ${
                      selected ? "border-brand ring-2 ring-brand/30" : "border-border"
                    }`}
                  >
                    {img.thumbnail_url ? (
                      <img src={img.thumbnail_url} alt={img.filename} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        Processing…
                      </div>
                    )}
                    {showAnnotations && <AnnotationOverlay img={img} />}
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleSelect(img.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-1.5 top-1.5 z-10 bg-background/90 shadow-sm data-[state=unchecked]:opacity-0 group-hover:data-[state=unchecked]:opacity-100"
                    />
                    <SplitBadge split={img.split} />
                    {img.is_null && <NullBadge />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={img.filename}>
                    {img.filename}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 pb-4 lg:grid-cols-2">
            {images.map((img) => {
              const selected = selectedIds.includes(img.id)
              const badge = img.split ? SPLIT_BADGE[img.split] : null
              const uniqueClasses = Array.from(
                new Map(img.annotations.map((a) => [a.class_name, a.class_color])).entries()
              )
              const expanded = expandedRowIds.includes(img.id)
              return (
                <div
                  key={img.id}
                  onClick={() => toggleSelect(img.id)}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-2.5 ${
                    selected ? "border-brand bg-brand/5" : "border-border"
                  }`}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleSelect(img.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="relative size-16 shrink-0 overflow-hidden rounded bg-muted">
                    {img.thumbnail_url && (
                      <img src={img.thumbnail_url} alt={img.filename} className="size-full object-cover" />
                    )}
                    {showAnnotations && <AnnotationOverlay img={img} />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 text-xs">
                    <p className="truncate">
                      <span className="font-semibold tracking-wide text-muted-foreground uppercase">Filename:</span>{" "}
                      <span className="text-foreground">{img.filename}</span>
                    </p>
                    <p>
                      <span className="font-semibold tracking-wide text-muted-foreground uppercase">Annotations:</span>{" "}
                      <span className="text-foreground">{img.annotations.length} Total</span>{" "}
                      {uniqueClasses.length > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpandedRow(img.id)
                          }}
                          className="inline-flex items-center gap-0.5 font-medium text-brand italic hover:underline"
                        >
                          {uniqueClasses.length} Class{uniqueClasses.length !== 1 && "es"}
                          <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </button>
                      ) : (
                        <span className="italic text-muted-foreground">N/A Classes</span>
                      )}
                    </p>
                    {expanded && uniqueClasses.length > 0 && (
                      <div className="flex flex-wrap gap-1 pb-0.5">
                        {uniqueClasses.map(([name, color]) => (
                          <span
                            key={name}
                            className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground"
                          >
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                    <p>
                      <span className="font-semibold tracking-wide text-muted-foreground uppercase">Tags:</span>{" "}
                      <span className="text-foreground">{img.tag_count} Total</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="font-semibold tracking-wide text-muted-foreground uppercase">Split:</span>{" "}
                      {badge && (
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                          <badge.icon className="size-2.5" />
                          {badge.label}
                        </span>
                      )}
                      {img.is_null && (
                        <span className="flex items-center gap-1 rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-medium text-white">
                          <Ban className="size-2.5" />
                          Null
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="shrink-0 px-4 pt-2 pb-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-background px-4 py-2.5 shadow-lg">
            <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} />
            <span className="text-sm font-medium text-foreground">{selectedIds.length} images selected</span>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={() => setTagDialogOpen(true)} disabled={selectedIds.length === 0}>
              <TagIcon className="size-3.5" />
              Add Tags & Metadata
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAssignPanelOpen(true)} disabled={selectedIds.length === 0}>
              <UserPlus className="size-3.5" />
              Assign for Labeling
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkNull}
              disabled={selectedIds.length === 0 || markingNull}
              title="Confirms these images have nothing to detect — clears their annotations and includes them as background examples"
            >
              <Ban className="size-3.5" />
              {markingNull ? "Marking…" : "Mark Null"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSplitDialogOpen(true)} disabled={selectedIds.length === 0}>
              <SplitSquareHorizontal className="size-3.5" />
              Change Dataset Split
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0 || deletingSelected}
            >
              <Trash2 className="size-3.5" />
              {deletingSelected ? "Deleting…" : "Delete Images"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
              <Download className="size-3.5" />
              Export
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-between px-1 text-sm text-muted-foreground">
            <span>Images per page: {PAGE_SIZE}</span>
            <div className="flex items-center gap-3">
              <span>
                {page * PAGE_SIZE + 1} - {Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
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
            <DialogTitle>Tags & metadata for {selectedIds.length} image{selectedIds.length !== 1 && "s"}</DialogTitle>
          </DialogHeader>
          <TagInput value={tagDraft} onChange={setTagDraft} placeholder="Type a tag and press Enter…" />

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
                    <button
                      type="button"
                      onClick={() => setMetadataPairs((prev) => prev.filter((x) => x.key !== p.key))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)} disabled={applyingTags}>
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

      <Dialog open={splitDialogOpen} onOpenChange={applyingSplit ? undefined : setSplitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Dataset Split</DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground">{selectedIds.length} images selected</p>
          <div className="grid grid-cols-3 gap-4 py-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Train</p>
              <p className="text-lg font-semibold text-foreground">{splitCounts.train}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valid</p>
              <p className="text-lg font-semibold text-foreground">{splitCounts.valid}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Test</p>
              <p className="text-lg font-semibold text-foreground">{splitCounts.test}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="border-brand/40 text-brand hover:bg-brand/5"
              onClick={() => handleSetAllSplit("train")}
              disabled={applyingSplit}
            >
              <Activity className="size-3.5" />
              Set All to Train
            </Button>
            <Button
              variant="outline"
              className="border-blue-400/50 text-blue-600 hover:bg-blue-50"
              onClick={() => handleSetAllSplit("valid")}
              disabled={applyingSplit}
            >
              <ShieldCheck className="size-3.5" />
              Set All to Valid
            </Button>
            <Button
              variant="outline"
              className="border-orange-400/50 text-orange-600 hover:bg-orange-50"
              onClick={() => handleSetAllSplit("test")}
              disabled={applyingSplit}
            >
              <Pencil className="size-3.5" />
              Set All to Test
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {workspaceId && projectId && (
        <AssignForLabelingPanel
          workspaceId={workspaceId}
          projectId={projectId}
          imageIds={selectedIds}
          open={assignPanelOpen}
          onOpenChange={setAssignPanelOpen}
          onAssigned={() => {
            addToast({ variant: "success", title: "Images assigned for labeling" })
            setSelectedIds([])
            refetch()
          }}
        />
      )}

      {workspaceId && projectId && (
        <ExportDatasetDialog
          workspaceId={workspaceId}
          projectId={projectId}
          annotationType={project?.annotation_type ?? "object_detection"}
          classCount={classes.length}
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
        />
      )}
    </>
  )
}
