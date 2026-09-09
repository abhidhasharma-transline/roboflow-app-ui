import { useEffect, useRef, useState } from "react"
import { CheckCircle2, FileText, BoxSelect, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  fetchBatchPreview,
  appendImagesToBatch,
  saveBatch,
} from "@/lib/uploadApi"
import type { BatchPreviewResponse, BatchPreviewTab, BatchPreviewImage } from "@/types/upload"

interface BatchReviewProps {
  workspaceId: string
  projectId: string
  batchId: string
  batchName: string
  tags: string[]
  onSaved: () => void
}

const TABS: { key: BatchPreviewTab; label: string }[] = [
  { key: "all", label: "All Images" },
  { key: "annotated", label: "Annotated" },
  { key: "unannotated", label: "Not Annotated" },
]

/** Thumbnail generation runs async on a worker — thumbnail_url can point at
 *  an object that doesn't exist in storage yet, which shows as a broken
 *  image. Fall back to a plain placeholder instead of a broken-image icon. */
function Thumb({ img }: { img: BatchPreviewImage }) {
  const [failed, setFailed] = useState(false)
  const hasImage = img.thumbnail_url && !failed

  return (
    <div className="relative size-full">
      {hasImage ? (
        <img
          src={img.thumbnail_url!}
          alt={img.filename}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
          Processing…
        </div>
      )}
    </div>
  )
}

const PAGE_SIZE = 50

export function BatchReview({
  workspaceId,
  projectId,
  batchId,
  batchName,
  tags,
  onSaved,
}: BatchReviewProps) {
  const [tab, setTab] = useState<BatchPreviewTab>("all")
  const [preview, setPreview] = useState<BatchPreviewResponse | null>(null)
  const [images, setImages] = useState<BatchPreviewImage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [adding, setAdding] = useState<{ percent: number; label: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Loads (or reloads) the FIRST page for a tab — used on tab switch,
  // initial mount, and the manual "Refresh" button. A batch can have
  // hundreds-to-thousands of images (fetchBatchPreview is already paginated
  // server-side, 50 at a time), so this only ever replaces what's currently
  // loaded, never re-fetches everything.
  async function refresh(targetTab: BatchPreviewTab = tab) {
    setLoading(true)
    try {
      const res = await fetchBatchPreview(workspaceId, projectId, batchId, { tab: targetTab, skip: 0, limit: PAGE_SIZE })
      setPreview(res)
      setImages(res.images)
    } catch {
      setError("Couldn't load this batch — try refreshing.")
    } finally {
      setLoading(false)
    }
  }

  function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    fetchBatchPreview(workspaceId, projectId, batchId, { tab, skip: images.length, limit: PAGE_SIZE })
      .then((res) => {
        setPreview(res)
        setImages((prev) => [...prev, ...res.images])
      })
      .finally(() => setLoadingMore(false))
  }

  useEffect(() => {
    refresh(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Thumbnails are generated asynchronously by a worker, one Celery task per
  // image — for a small upload that finishes in a few seconds, but for a
  // several-hundred-image batch it can genuinely take minutes. Re-fetch just
  // the currently-loaded page every few seconds until none of THOSE images
  // are still "Processing…" (not a fixed short attempt count, which used to
  // give up well before large batches were actually done, leaving the grid
  // stuck showing "Processing…" until a manual Refresh click), capped at 10
  // minutes as a safety net so a genuinely stuck thumbnail doesn't poll forever.
  useEffect(() => {
    if (images.length === 0) return
    if (images.every((img) => img.thumbnail_url)) return
    let cancelled = false
    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      if (cancelled || attempts > 200) {
        clearInterval(interval)
        return
      }
      try {
        const res = await fetchBatchPreview(workspaceId, projectId, batchId, { tab, skip: 0, limit: images.length })
        if (cancelled) return
        setPreview(res)
        setImages(res.images)
        if (res.images.every((img) => img.thumbnail_url)) {
          clearInterval(interval)
        }
      } catch {
        // ignore — next tick will retry, or it'll just stop after the cap
      }
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, images.length])

  async function handleAddFiles(fileList: FileList, folderName?: string) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setAdding({ percent: 0, label: `Processing files…` })
    try {
      await appendImagesToBatch(
        workspaceId,
        projectId,
        batchId,
        files,
        folderName,
        (percent) => setAdding({ percent, label: `Processing files…` })
      )
      await refresh()
    } catch {
      setError("Some files couldn't be added — try again.")
    } finally {
      setAdding(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await saveBatch(workspaceId, projectId, batchId, batchName, tags)
      onSaved()
    } catch {
      setError("Couldn't save the batch — try again.")
      setSaving(false)
    }
  }

  if (adding) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 p-16 text-center">
        <p className="text-lg font-semibold text-brand">{adding.label}</p>
        <Progress value={adding.percent} className="w-full max-w-sm" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  tab === t.key ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {preview?.counts[t.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => refresh()}
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Refresh thumbnails"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">
              Drag and drop images, annotations, and videos.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              .jpg, .png, .bmp, .webp, .avif &nbsp;·&nbsp; .mov, .mp4 &nbsp;·&nbsp; Max size of 20MB
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileText className="size-4" />
              Select Files
            </Button>
            <Button variant="outline" onClick={() => folderInputRef.current?.click()}>
              <BoxSelect className="size-4" />
              Select Folder
            </Button>
            <Button
              variant="brand"
              onClick={handleSave}
              disabled={saving || preview?.counts.all === 0}
              title={preview?.counts.all === 0 ? "There's nothing in this batch to save" : undefined}
            >
              {saving ? "Saving…" : "Save and Continue"}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/bmp,image/webp,image/avif"
            className="hidden"
            onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-expect-error — non-standard but supported by every major browser
            webkitdirectory=""
            className="hidden"
            onChange={(e) => {
              if (!e.target.files || e.target.files.length === 0) return
              const first = e.target.files[0] as File & { webkitRelativePath?: string }
              const folderName = first.webkitRelativePath?.split("/")[0] ?? "Folder upload"
              handleAddFiles(e.target.files, folderName)
            }}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading images…
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="size-8 text-muted-foreground/40" />
            No images in this tab yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {images.map((img) => (
                <div key={img.id} className="flex flex-col gap-1.5 [content-visibility:auto] [contain-intrinsic-size:0_220px]">
                  <div className="aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted">
                    <Thumb img={img} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={img.filename}>
                    {img.filename}
                  </p>
                </div>
              ))}
            </div>
            {images.length < (preview?.counts[tab] ?? 0) && (
              <div className="flex flex-col items-center gap-2 pb-2">
                <p className="text-xs text-muted-foreground">
                  {images.length} / {preview?.counts[tab] ?? 0} images
                </p>
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}
