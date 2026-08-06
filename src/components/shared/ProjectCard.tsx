import { Link } from "react-router-dom"
import { Scan, Lock, MoreVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Project } from "@/types/project"

const typeLabels: Record<Project["annotation_type"], string> = {
  object_detection: "Object Detection",
  classification: "Classification",
  segmentation: "Segmentation",
  keypoint: "Keypoint Detection",
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return "today"
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? "" : "s"} ago`
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}/train`}
      className="group block overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:border-brand/30 hover:shadow-[0_0_18px_-6px_rgba(168,85,247,0.25)]"
    >
      <div className="flex aspect-[16/9] items-center justify-center bg-muted">
        <Scan className="size-8 text-muted-foreground/30" />
      </div>

      <div className="p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Badge variant="secondary" className="gap-1 font-normal">
            <Scan className="size-3" />
            {typeLabels[project.annotation_type]}
          </Badge>
          <button
            onClick={(e) => e.preventDefault()}
            className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
          >
            <MoreVertical className="size-4" />
          </button>
        </div>

        <h3 className="truncate text-sm font-semibold text-foreground">
          {project.name}
        </h3>
        {project.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {project.description}
          </p>
        )}
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Private · Created {timeAgo(project.created_at)}
        </p>
      </div>
    </Link>
  )
}