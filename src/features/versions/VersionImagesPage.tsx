import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ImageIcon, ArrowLeft, User, Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/shared/PageLoader"
import { ScrollToTopButton } from "@/components/shared/ScrollToTopButton"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { listVersions, getVersionImages, type ProjectVersion, type VersionImageSummary } from "@/lib/versionApi"
import { objectCoverViewBox } from "@/lib/thumbnailGeometry"
import { preprocessingPreviewStyle } from "@/lib/versionPreview"

const RESIZE_MODE_LABELS: Record<string, string> = {
  stretch: "Stretch to",
  fill_center_crop: "Fill to",
  fit_within: "Fit within",
  fit_reflect: "Fit (reflect) in",
  fit_black_edges: "Fit (black) in",
  fit_white_edges: "Fit (white) in",
}

const SPLIT_TABS = ["train", "valid", "test"] as const
const PAGE_SIZE = 60

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

export function VersionImagesPage() {
  const { projectId, versionId } = useParams()
  const navigate = useNavigate()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)

  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [images, setImages] = useState<VersionImageSummary[]>([])
  const [loadingImages, setLoadingImages] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState<(typeof SPLIT_TABS)[number]>("train")
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!workspaceId || !projectId) return
    setLoadingVersions(true)
    listVersions(workspaceId, projectId).then(setVersions).finally(() => setLoadingVersions(false))
  }, [workspaceId, projectId])

  // A version can hold thousands of images — fetch only the active tab's
  // split, one page at a time (getVersionImages is now paginated server-
  // side), instead of pulling every image in the version on every load.
  useEffect(() => {
    if (!workspaceId || !projectId || !versionId) return
    setLoadingImages(true)
    setImages([])
    getVersionImages(workspaceId, projectId, versionId, { split: activeTab, skip: 0, limit: PAGE_SIZE })
      .then((res) => setImages(res.items))
      .finally(() => setLoadingImages(false))
  }, [workspaceId, projectId, versionId, activeTab])

  function loadMoreImages() {
    if (!workspaceId || !projectId || !versionId || loadingMore) return
    setLoadingMore(true)
    getVersionImages(workspaceId, projectId, versionId, { split: activeTab, skip: images.length, limit: PAGE_SIZE })
      .then((res) => setImages((prev) => [...prev, ...res.items]))
      .finally(() => setLoadingMore(false))
  }

  const ordinals = useMemo(() => {
    const ascending = [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at))
    return new Map(ascending.map((v, i) => [v.id, i + 1]))
  }, [versions])

  const version = versions.find((v) => v.id === versionId) ?? null
  const previewStyle = preprocessingPreviewStyle(version?.preprocessing)
  const tabCounts = {
    train: version?.split_ratio?.train.count ?? 0,
    valid: version?.split_ratio?.valid.count ?? 0,
    test: version?.split_ratio?.test.count ?? 0,
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
        <div className="bg-foreground px-4 py-2.5 text-sm font-semibold text-background">Versions</div>
        <div className="p-3">
          {loadingVersions ? (
            <PageLoader />
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => navigate(`/projects/${projectId}/versions/${v.id}/images`)}
                  className={`rounded-md border p-2.5 text-left ${
                    v.id === versionId ? "border-brand bg-brand/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <p className="flex items-center gap-1.5">
                    <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
                      v{ordinals.get(v.id) ?? "?"}
                    </span>
                    <span className={`truncate text-sm font-semibold ${v.id === versionId ? "text-brand" : "text-foreground"}`}>
                      {v.name}
                    </span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <User className="size-2.5" />
                      {v.created_by_name ?? "Unknown"}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <ImageIcon className="size-2.5" />
                      {v.image_count}
                    </span>
                    {v.preprocessing?.resize && (
                      <>
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {v.preprocessing.resize.width}×{v.preprocessing.resize.height}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {RESIZE_MODE_LABELS[v.preprocessing.resize.mode] ?? v.preprocessing.resize.mode}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8">
        <button
          onClick={() => navigate(`/projects/${projectId}/versions`)}
          className="mb-3 flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Versions
        </button>
        <h1 className="mb-6 flex items-center gap-2.5 text-2xl font-semibold text-foreground">
          <ImageIcon className="size-6" />
          Images
        </h1>

        <div className="rounded-lg border border-border">
          <div className="p-5">
            <p className="mb-4 text-lg font-semibold text-foreground">
              {version?.image_count ?? 0} <span className="font-normal text-muted-foreground">Total Images</span>
            </p>

            <div className="flex items-center gap-6 border-b border-border">
              {SPLIT_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "border-brand text-brand"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeTab === tab ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tabCounts[tab]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 pt-0">
            {loadingImages ? (
              <PageLoader />
            ) : images.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">No images in this split.</p>
            ) : (
              <div className="grid grid-cols-4 gap-4 pb-5 sm:grid-cols-6 lg:grid-cols-8">
                {images.map((img, index) => (
                  <button
                    key={img.id}
                    onClick={() => setPreviewIndex(index)}
                    className="group relative aspect-square overflow-hidden rounded-md bg-muted [content-visibility:auto] [contain-intrinsic-size:0_150px]"
                  >
                    {img.thumbnail_url && (
                      <img
                        src={img.thumbnail_url}
                        alt={img.filename}
                        className="size-full object-cover"
                        style={previewStyle}
                      />
                    )}
                    <ThumbAnnotations img={img} containerAspect={1} />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-colors group-hover:bg-black/30 group-hover:opacity-100">
                      <Maximize2 className="size-5 text-white" />
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {images.length} / {tabCounts[activeTab]} images
              </p>
              {images.length < tabCounts[activeTab] && (
                <Button variant="outline" size="sm" onClick={loadMoreImages} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ScrollToTopButton containerRef={scrollRef} />

      <Dialog open={previewIndex !== null} onOpenChange={(v) => !v && setPreviewIndex(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-5xl gap-0 border-none bg-transparent p-0 shadow-none"
        >
          {previewIndex !== null && images[previewIndex] && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm text-white">
                <p className="truncate font-medium">{images[previewIndex].filename}</p>
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
                  {images[previewIndex].image_url ? (
                    <img
                      src={images[previewIndex].image_url ?? undefined}
                      alt={images[previewIndex].filename}
                      className="max-h-[80vh] max-w-full object-contain"
                      style={previewStyle}
                    />
                  ) : (
                    <div className="flex h-64 w-96 items-center justify-center text-sm text-muted-foreground">
                      Preview unavailable
                    </div>
                  )}
                  <ThumbAnnotations
                    img={images[previewIndex]}
                    containerAspect={(images[previewIndex].width || 1) / (images[previewIndex].height || 1)}
                  />
                </div>

                {previewIndex < images.length - 1 && (
                  <button
                    onClick={() => setPreviewIndex((i) => (i !== null ? i + 1 : i))}
                    className="absolute right-2 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                )}
              </div>

              <p className="text-center text-xs text-white/70">
                {previewIndex + 1} of {images.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
