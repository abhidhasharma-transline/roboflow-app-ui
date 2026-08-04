import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ClipboardList, Upload, MoreVertical } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { listBatches } from "@/lib/jobApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import type { BatchSummary } from "@/types/job"

function BatchCard({ batch, projectId }: { batch: BatchSummary; projectId: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-start justify-between">
        <p className="text-sm font-medium text-foreground">
          {new Date(batch.created_at).toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit",
          })}{" "}
          — {batch.name}
        </p>
        <button className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="size-4" />
        </button>
      </div>
      <p className="mb-3 text-sm text-foreground">
        {batch.unassigned_count} Unassigned Image{batch.unassigned_count !== 1 && "s"}
      </p>
      <Link
        to={`/projects/${projectId}/annotate/batch/${batch.id}`}
        className="text-sm font-medium text-brand hover:underline"
      >
        Annotate Images →
      </Link>
    </div>
  )
}

export function AnnotatePage() {
  const { projectId } = useParams()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const [unassignedBatches, setUnassignedBatches] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId || !projectId) return
    listBatches(workspaceId, projectId, "unassigned")
      .then(setUnassignedBatches)
      .finally(() => setLoading(false))
  }, [workspaceId, projectId])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-foreground">
          <ClipboardList className="size-6" />
          Annotate
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort By:</span>
          <Select defaultValue="newest">
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Unassigned — real batches */}
          <div className="flex flex-col rounded-xl border border-border">
            <div className="border-b border-border p-4 text-center">
              <h2 className="text-base font-semibold text-foreground">Unassigned</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {unassignedBatches.length} Batch{unassignedBatches.length !== 1 && "es"}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              {unassignedBatches.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <Link
                    to={`/projects/${projectId}/upload`}
                    className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                  >
                    <Upload className="size-3.5" />
                    Upload More Images
                  </Link>
                </div>
              ) : (
                unassignedBatches.map((b) => (
                  <BatchCard key={b.id} batch={b} projectId={projectId!} />
                ))
              )}
            </div>
          </div>

          {/* Annotating — job listing endpoint not built yet, placeholder */}
          <div className="flex flex-col rounded-xl border border-border">
            <div className="border-b border-border p-4 text-center">
              <h2 className="text-base font-semibold text-foreground">Annotating</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">0 Jobs</p>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Images currently being labeled show up here.
              </p>
            </div>
          </div>

          {/* Dataset — same */}
          <div className="flex flex-col rounded-xl border border-border">
            <div className="border-b border-border p-4 text-center">
              <h2 className="text-base font-semibold text-foreground">Dataset</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">0 Jobs</p>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Approve annotated images to add them to your dataset.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
