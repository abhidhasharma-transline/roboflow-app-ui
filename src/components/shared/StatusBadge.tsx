import { Badge } from "@/components/ui/badge"
import type { ImageStatus } from "@/types/image"
import type { JobStatus } from "@/types/annotation"

const imageStatusConfig: Record<ImageStatus, { label: string; variant: "secondary" | "warning" | "success" }> = {
  unassigned: { label: "Unassigned", variant: "secondary" },
  annotating: { label: "Annotating", variant: "warning" },
  dataset: { label: "In Dataset", variant: "success" },
}

const jobStatusConfig: Record<JobStatus, { label: string; variant: "secondary" | "warning" | "success" }> = {
  "not-started": { label: "Not started", variant: "secondary" },
  "in-progress": { label: "In progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
}

export function ImageStatusBadge({ status }: { status: ImageStatus }) {
  const config = imageStatusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = jobStatusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
