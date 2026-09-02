import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Scan, Shapes } from "lucide-react"
import { cn } from "@/lib/utils"
import { createProject } from "@/lib/projectApi"
import type { ProjectAnnotationType } from "@/types/project"

interface CreateProjectDialogProps {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId?: string
  onCreated?: () => void
}

const typeOptions: {
  value: ProjectAnnotationType
  icon: typeof Scan
  label: string
  description: string
}[] = [
  {
    value: "object_detection",
    icon: Scan,
    label: "Object Detection",
    description: "Identify objects and their positions with bounding boxes.",
  },
  {
    value: "segmentation",
    icon: Shapes,
    label: "Segmentation",
    description: "Detect multiple objects and their actual shape.",
  },
]

export function CreateProjectDialog({
  workspaceId,
  open,
  onOpenChange,
  folderId,
  onCreated,
}: CreateProjectDialogProps) {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<ProjectAnnotationType>("object_detection")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName("")
    setDescription("")
    setType("object_detection")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      const project = await createProject(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        annotation_type: type,
        folder_id: folderId ?? null,
      })
      onCreated?.()
      reset()
      onOpenChange(false)
      navigate(`/projects/${project.id}/train`)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isSubmitting) {
          onOpenChange(v)
          if (!v) reset()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Let's create your project.</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g., 'Conveyor Defect Detection'"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Visibility</Label>
              <span className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                <Lock className="size-3.5" />
                Private
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">Description (optional)</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project for?"
            />
          </div>

          <div>
            <Label className="mb-2 block">Project Type</Label>
            <div className="flex flex-col gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    type === opt.value
                      ? "border-brand ring-1 ring-brand"
                      : "border-border hover:border-foreground/30"
                  )}
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <opt.icon className="size-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                reset()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Couldn't create project — please try again."
}