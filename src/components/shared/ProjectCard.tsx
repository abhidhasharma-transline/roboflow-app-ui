import { Link } from "react-router-dom"
import { Scan, MoreVertical, Globe2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Project } from "@/types/project"

const typeLabels: Record<Project["type"], string> = {
  "object-detection": "Object Detection",
  classification: "Classification",
  segmentation: "Segmentation",
  "keypoint-detection": "Keypoint Detection",
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
      className="group block overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] bg-muted">
        {project.thumbnailUrl && (
          <img
            src={project.thumbnailUrl}
            alt=""
            className="size-full object-cover"
          />
        )}
        <span className="absolute top-2 left-2 size-4 rounded-full border-2 border-white/90 shadow-sm" />
      </div>

      <div className="p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Badge variant="secondary" className="gap-1 font-normal">
            <Scan className="size-3" />
            {typeLabels[project.type]}
          </Badge>
          <button
            onClick={(e) => e.preventDefault()}
            className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
          >
            <MoreVertical className="size-4" />
          </button>
        </div>

        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Globe2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{project.name}</span>
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Edited {timeAgo(project.updatedAt)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {project.isPublic ? "Public" : "Private"} · {project.imageCount.toLocaleString()} Images ·{" "}
          {project.modelCount} Model{project.modelCount !== 1 && "s"}
        </p>
      </div>
    </Link>
  )
}