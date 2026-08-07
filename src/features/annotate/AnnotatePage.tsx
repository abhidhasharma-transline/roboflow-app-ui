import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ClipboardList, Upload, MoreVertical, Info } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { listBatches, listJobs } from "@/lib/jobApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import type { BatchSummary, JobSummary } from "@/types/job"

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

function ActiveJobCard({ job, projectId }: { job: JobSummary; projectId: string }) {
  const percent = job.total_images === 0 ? 0 : Math.round((job.annotated_count / job.total_images) * 100)

  const labelerText =
    job.assignments.length === 0
      ? null
      : job.assignments.length === 1
        ? job.assignments[0].name
        : `${job.assignments[0].name} +${job.assignments.length - 1} more`

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Uploaded on{" "}
          {new Date(job.batch_created_at).toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit",
          })}{" "}
          at{" "}
          {new Date(job.batch_created_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).toLowerCase()}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger className="shrink-0 text-muted-foreground hover:text-foreground">
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Rename Job</DropdownMenuItem>
            <DropdownMenuItem>Tag Images</DropdownMenuItem>
            <DropdownMenuItem>Move to unassigned</DropdownMenuItem>
            <DropdownMenuItem>Download</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Delete all annotations</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {labelerText && (
        <p className="mb-3 text-sm text-foreground">
          <span className="font-medium">Labeler:</span> {labelerText}
        </p>
      )}

      <Progress value={percent} className="mb-1.5" />

      <p className="mb-1 text-sm font-medium text-foreground">
        {job.total_images} Image{job.total_images !== 1 && "s"}
      </p>
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                job.annotated_count > 0 ? "bg-brand" : "border border-muted-foreground"
              }`}
            />
            {job.annotated_count} Annotated
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full border border-muted-foreground" />
            {job.unannotated_count} Unannotated
          </span>
        </div>
        <span
          className="shrink-0"
          title="Annotated = images with at least one label saved. Unannotated = still to do."
        >
          <Info className="size-3.5" />
        </span>
      </div>

      <div className="text-right">
        <Link
          to={`/projects/${projectId}/annotate/job/${job.id}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          Start Annotating →
        </Link>
      </div>
    </div>
  )
}

export function AnnotatePage() {
  const { projectId } = useParams()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const [unassignedBatches, setUnassignedBatches] = useState<BatchSummary[]>([])
  const [activeJobs, setActiveJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId || !projectId) return
    Promise.all([
      listBatches(workspaceId, projectId, "unassigned"),
      listJobs(workspaceId, projectId, "active"),
    ])
      .then(([batches, jobs]) => {
        setUnassignedBatches(batches)
        setActiveJobs(jobs)
      })
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

          {/* Annotating — real active jobs */}
          <div className="flex flex-col rounded-xl border border-border">
            <div className="border-b border-border p-4 text-center">
              <h2 className="text-base font-semibold text-foreground">Annotating</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {activeJobs.length} Job{activeJobs.length !== 1 && "s"}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              {activeJobs.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Images currently being labeled show up here.
                  </p>
                </div>
              ) : (
                activeJobs.map((job) => (
                  <ActiveJobCard key={job.id} job={job} projectId={projectId!} />
                ))
              )}
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
