import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Layers,
  Pencil,
  Download,
  Trash2,
  Activity,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToastStore } from "@/stores/toastStore"
import {
  getVersionImages,
  renameVersion,
  deleteVersion,
  type ProjectVersion,
  type VersionImageSummary,
} from "@/lib/versionApi"
import { objectCoverViewBox } from "@/lib/thumbnailGeometry"
import type { ProjectAnnotationType } from "@/types/project"
import { DownloadVersionDialog } from "./DownloadVersionDialog"
import { DeleteVersionDialog } from "./DeleteVersionDialog"

function annotationTypeLabel(type: ProjectAnnotationType) {
  return type.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
}

function initialsFromName(name: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

function ThumbAnnotations({ img, containerAspect }: { img: VersionImageSummary; containerAspect: number }) {
  if (img.annotations.length === 0) return null
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox={objectCoverViewBox(img.width, img.height, containerAspect)}
      preserveAspectRatio="none"
    >
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

export function VersionDetailView({
  workspaceId,
  projectId,
  version,
  annotationType,
  onRenamed,
  onDeleted,
}: {
  workspaceId: string
  projectId: string
  version: ProjectVersion
  annotationType: ProjectAnnotationType
  onRenamed: (v: ProjectVersion) => void
  onDeleted: () => void
}) {
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  const [images, setImages] = useState<VersionImageSummary[]>([])
  const [loadingImages, setLoadingImages] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(version.name)
  const [saving, setSaving] = useState(false)

  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    setNameDraft(version.name)
    setEditingName(false)
    setLoadingImages(true)
    // Only the first 8 are ever shown here (a preview strip, not a full
    // browser) — ask the paginated endpoint for exactly that instead of
    // pulling every image in the version just to slice it down client-side.
    getVersionImages(workspaceId, projectId, version.id, { limit: 8 })
      .then((res) => setImages(res.items))
      .finally(() => setLoadingImages(false))
  }, [workspaceId, projectId, version.id])

  async function handleRename() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === version.name) {
      setEditingName(false)
      setNameDraft(version.name)
      return
    }
    setSaving(true)
    try {
      const updated = await renameVersion(workspaceId, projectId, version.id, trimmed)
      onRenamed(updated)
      setEditingName(false)
    } catch {
      addToast({ variant: "error", title: "Couldn't rename version", description: "Please try again." })
      setNameDraft(version.name)
    } finally {
      setSaving(false)
    }
  }


  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteVersion(workspaceId, projectId, version.id)
      addToast({ variant: "success", title: "Version deleted", description: version.name })
      onDeleted()
    } catch {
      addToast({ variant: "error", title: "Couldn't delete version", description: "Please try again." })
      setDeleting(false)
    }
  }

  const splitCards = [
    { key: "train" as const, label: "Train Set", icon: Activity, badge: "bg-brand text-brand-foreground" },
    { key: "valid" as const, label: "Valid Set", icon: ShieldCheck, badge: "bg-blue-500 text-white" },
    { key: "test" as const, label: "Test Set", icon: Pencil, badge: "bg-orange-500 text-white" },
  ]

  const preprocessingEntries: string[] = []
  if (version.preprocessing?.auto_orient) preprocessingEntries.push("Auto-Orient: Applied")
  if (version.preprocessing?.resize)
    preprocessingEntries.push(
      `Resize: ${version.preprocessing.resize.width}×${version.preprocessing.resize.height}`
    )
  if (version.preprocessing?.grayscale) preprocessingEntries.push("Grayscale: Applied")
  if (version.preprocessing?.auto_contrast) preprocessingEntries.push("Auto-Adjust Contrast: Applied")
  if (version.preprocessing?.random_sample) preprocessingEntries.push("Random Sample: Applied")

  const augmentationLabels = Object.values(version.augmentations ?? {}).map((a) => a.label)

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Layers className="size-3.5" />
        Dataset Version
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium normal-case text-foreground">
          {annotationTypeLabel(annotationType)}
        </span>
      </p>

      <div className="mb-1 flex items-center justify-between gap-4">
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              onBlur={handleRename}
              disabled={saving}
              className="h-9 w-64 text-xl font-semibold"
            />
          </div>
        ) : (
          <button onClick={() => setEditingName(true)} className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            {version.name}
            <Pencil className="size-4 text-muted-foreground" />
          </button>
        )}
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setDownloadDialogOpen(true)}>
            <Download className="size-4" />
            Download Dataset
          </Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      <p className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        By
        <Avatar className="size-5">
          <AvatarFallback className="bg-brand/15 text-[9px] text-brand">
            {initialsFromName(version.created_by_name)}
          </AvatarFallback>
        </Avatar>
        {version.created_by_name ?? "Unknown"} on{" "}
        {new Date(version.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-lg font-semibold text-foreground">
          {version.image_count} <span className="font-normal text-muted-foreground">Total Images</span>
        </p>
        <button
          onClick={() => navigate(`/projects/${projectId}/versions/${version.id}/images`)}
          className="text-sm font-medium text-brand hover:underline"
        >
          View All Images →
        </button>
      </div>

      {loadingImages ? (
        <p className="mb-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mb-8 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {images.slice(0, 8).map((img) => (
            <div key={img.id} className="relative aspect-square overflow-hidden rounded-md bg-muted">
              {img.thumbnail_url && <img src={img.thumbnail_url} alt={img.filename} className="size-full object-cover" />}
              <ThumbAnnotations img={img} containerAspect={1} />
            </div>
          ))}
        </div>
      )}

      <p className="mb-3 text-sm font-semibold text-foreground">Dataset Split</p>
      <div className="mb-8 grid grid-cols-3 gap-4">
        {splitCards.map((s) => {
          const stat = version.split_ratio?.[s.key]
          return (
            <div key={s.key} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.label}</span>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>
                  <s.icon className="size-2.5" />
                  {stat?.percent ?? 0}%
                </span>
              </div>
              <p className="text-xl font-semibold text-foreground">
                {stat?.count ?? 0} <span className="text-sm font-normal text-muted-foreground">Images</span>
              </p>
            </div>
          )
        })}
      </div>

      <div className="mb-6 grid grid-cols-[140px_1fr] gap-4 border-t border-border pt-6 text-sm">
        <p className="font-semibold text-foreground">Preprocessing</p>
        <p className="text-muted-foreground">
          {preprocessingEntries.length > 0 ? preprocessingEntries.join(" · ") : "None"}
        </p>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-4 border-t border-border pt-6 text-sm">
        <p className="font-semibold text-foreground">Augmentations</p>
        <p className="text-muted-foreground">
          {augmentationLabels.length > 0 ? augmentationLabels.join(" · ") : "None"}
        </p>
      </div>

      <DownloadVersionDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        workspaceId={workspaceId}
        projectId={projectId}
        versionId={version.id}
      />
      <DeleteVersionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        versionName={version.name}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  )
}
