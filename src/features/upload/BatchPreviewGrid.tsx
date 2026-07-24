import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { fetchBatchPreview, saveBatch } from "@/lib/uploadApi"
import type { BatchPreviewResponse, BatchPreviewTab } from "@/types/upload"

interface BatchPreviewGridProps {
  workspaceId: string
  projectId: string
  batchId: string
  batchName: string
  tags: string[]
  /** Called after "Save and Continue" succeeds. */
  onSaved: () => void
}

export function BatchPreviewGrid({
  workspaceId,
  projectId,
  batchId,
  batchName,
  tags,
  onSaved,
}: BatchPreviewGridProps) {
  const [tab, setTab] = useState<BatchPreviewTab>("all")
  const [data, setData] = useState<BatchPreviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    fetchBatchPreview(workspaceId, projectId, batchId, { tab })
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [workspaceId, projectId, batchId, tab])

  async function handleSaveAndContinue() {
    setIsSaving(true)
    try {
      await saveBatch(workspaceId, projectId, batchId, batchName, tags)
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as BatchPreviewTab)}>
          <TabsList>
            <TabsTrigger value="all">
              All Images{data ? ` (${data.counts.all})` : ""}
            </TabsTrigger>
            <TabsTrigger value="annotated">
              Annotated{data ? ` (${data.counts.annotated})` : ""}
            </TabsTrigger>
            <TabsTrigger value="unannotated">
              Not Annotated{data ? ` (${data.counts.unannotated})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="brand" onClick={handleSaveAndContinue} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save and Continue"}
        </Button>
      </div>

      <Tabs value={tab}>
        <TabsContent value={tab}>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : !data || data.images.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
              No images in this view yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {data.images.map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted"
                >
                  {img.thumbnail_url ? (
                    <img
                      src={img.thumbnail_url}
                      alt={img.filename}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      {img.is_duplicate ? "Duplicate" : "No preview"}
                    </div>
                  )}
                  {img.is_duplicate && (
                    <span className="absolute top-1.5 left-1.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Duplicate
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}