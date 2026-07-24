import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, UserPlus } from "lucide-react"
import { Topbar } from "@/components/layout/Topbar"
import { Button } from "@/components/ui/button"
import { ImageGrid } from "@/components/shared/ImageGrid"
import { useImages } from "@/hooks/useImages"
import type { ImageStatus } from "@/types/image"

export function BatchView() {
  const { projectId, status } = useParams<{ projectId: string; status: ImageStatus }>()
  const navigate = useNavigate()
  const { images, isLoading } = useImages(projectId)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = images.filter((img) => img.status === status)

  return (
    <>
      <Topbar>
        <button
          onClick={() => navigate(`/projects/${projectId}/annotate`)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Annotate
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="capitalize">{status}</span>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} selected`
              : `${filtered.length} images`}
          </p>
          {selected.size > 0 && (
            <Button variant="brand" size="sm">
              <UserPlus className="size-4" />
              Assign to annotator
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading images…</p>
        ) : (
          <ImageGrid
            images={filtered}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
          />
        )}
      </div>
    </>
  )
}
