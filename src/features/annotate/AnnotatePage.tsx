import { useMemo } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { ClipboardList, Upload } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { ImageGrid } from "@/components/shared/ImageGrid"
import { useImages } from "@/hooks/useImages"
import type { ImageStatus } from "@/types/image"

interface ColumnDef {
  key: ImageStatus
  title: string
  emptyHint: string
}

const columns: ColumnDef[] = [
  {
    key: "unassigned",
    title: "Unassigned",
    emptyHint: "Upload and assign images to an annotator.",
  },
  {
    key: "annotating",
    title: "Annotating",
    emptyHint: "Images currently being labeled show up here.",
  },
  {
    key: "dataset",
    title: "Dataset",
    emptyHint: "Approve annotated images to add them to your dataset.",
  },
]

export function AnnotatePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { images, isLoading } = useImages(projectId)

  const grouped = useMemo(() => {
    return columns.reduce(
      (acc, col) => {
        acc[col.key] = images.filter((img) => img.status === col.key)
        return acc
      },
      {} as Record<ImageStatus, typeof images>
    )
  }, [images])

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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {columns.map((col) => {
            const items = grouped[col.key]
            return (
              <div key={col.key} className="flex flex-col rounded-xl border border-border">
                <div className="border-b border-border p-4 text-center">
                  <h2 className="text-base font-semibold text-foreground">{col.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {items.length} {col.key === "unassigned" ? "Batches" : "Jobs"}
                  </p>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  {items.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                      {col.key === "unassigned" ? (
                        <Link
                          to={`/projects/${projectId}/upload`}
                          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                        >
                          <Upload className="size-3.5" />
                          Upload More Images
                        </Link>
                      ) : (
                        <p className="text-sm text-muted-foreground">{col.emptyHint}</p>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => navigate(`/projects/${projectId}/annotate/batch/${col.key}`)}
                      className="cursor-pointer"
                    >
                      <ImageGrid images={items.slice(0, 6)} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
