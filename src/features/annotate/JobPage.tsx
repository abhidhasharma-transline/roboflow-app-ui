import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { X, Pencil, Check, RotateCcw, Activity, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  getJob, getJobImages, getJobActivity, updateJobInstructions, updateJobTitle, listJobReviewers,
} from "@/lib/jobApi"
import { sendImageToUnannotated } from "@/lib/commentApi"
import { InstructionsEditor } from "@/components/shared/InstructionsEditor"
import { ScrollToTopButton } from "@/components/shared/ScrollToTopButton"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
import { ReassignJobDialog } from "./ReassignJobDialog"
import { SubmitForReviewDialog } from "./SubmitForReviewDialog"
import { AddToDatasetDialog } from "./AddToDatasetDialog"
import type { JobDetail, JobImageSummary, JobActivityEntry, JobReviewerSummary } from "@/types/job"

type Tab = "unannotated" | "annotated"

export function JobPage() {
  const { projectId, jobId } = useParams<{ projectId: string; jobId: string }>()
  const navigate = useNavigate()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)

  const [job, setJob] = useState<JobDetail | null>(null)
  const [tab, setTab] = useState<Tab>("unannotated")
  const [images, setImages] = useState<JobImageSummary[]>([])
  const [imagesTotal, setImagesTotal] = useState(0)
  const [loadingImages, setLoadingImages] = useState(true)
  const [loadingMoreImages, setLoadingMoreImages] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [addToDatasetOpen, setAddToDatasetOpen] = useState(false)
  const [sendingSelectedToUnannotated, setSendingSelectedToUnannotated] = useState(false)
  const addToast = useToastStore((s) => s.addToast)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [activity, setActivity] = useState<JobActivityEntry[]>([])

  const [editingInstructions, setEditingInstructions] = useState(false)
  const [instructionsDraft, setInstructionsDraft] = useState("")
  const [savingInstructions, setSavingInstructions] = useState(false)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState("")
  const [savingTitle, setSavingTitle] = useState(false)

  const [reassignOpen, setReassignOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewers, setReviewers] = useState<JobReviewerSummary[]>([])

  function refetchJob() {
    if (!workspaceId || !projectId || !jobId) return
    getJob(workspaceId, projectId, jobId).then(setJob)
  }

  async function handleSendSelectedToUnannotated() {
    if (!workspaceId || !projectId || selectedImageIds.length === 0 || sendingSelectedToUnannotated) return
    setSendingSelectedToUnannotated(true)
    try {
      const results = await Promise.allSettled(
        selectedImageIds.map((id) => sendImageToUnannotated(workspaceId, projectId, id))
      )
      // A 404 here just means that image is already gone (e.g. deleted
      // earlier, or a duplicate click) — not a real failure.
      const realFailures = results.filter(
        (r) => r.status === "rejected" && (r.reason as { response?: { status?: number } })?.response?.status !== 404
      )
      if (realFailures.length > 0) {
        addToast({ variant: "error", title: "Couldn't send some images", description: "Please try again." })
      } else {
        addToast({
          variant: "success",
          title: "Sent to unannotated",
          description: `${selectedImageIds.length} image${selectedImageIds.length !== 1 ? "s" : ""}`,
        })
      }
      setImages((prev) => prev.filter((img) => !selectedImageIds.includes(img.id)))
      setSelectedImageIds([])
      refetchJob()
    } finally {
      setSendingSelectedToUnannotated(false)
    }
  }

  function handleDatasetAdded(res: { job_id: string; images_added: number }) {
    addToast({
      variant: "success",
      title: "Added to dataset",
      description: `${res.images_added} image${res.images_added !== 1 ? "s" : ""}`,
    })
    // Promoted images move out of this job — it may now be empty (and
    // deleted server-side), so head back to the board rather than refetch.
    navigate(`/projects/${projectId}/annotate`)
  }

  function refetchActivity() {
    if (!workspaceId || !projectId || !jobId) return
    getJobActivity(workspaceId, projectId, jobId).then(setActivity)
  }

  function refetchReviewers() {
    if (!workspaceId || !projectId || !jobId) return
    listJobReviewers(workspaceId, projectId, jobId).then(setReviewers)
  }

  useEffect(refetchJob, [workspaceId, projectId, jobId])
  useEffect(refetchActivity, [workspaceId, projectId, jobId])
  useEffect(refetchReviewers, [workspaceId, projectId, jobId])

  const JOB_IMAGES_PAGE_SIZE = 60

  useEffect(() => {
    if (!workspaceId || !projectId || !jobId) return
    setLoadingImages(true)
    setSelectedImageIds([])
    getJobImages(workspaceId, projectId, jobId, tab, { skip: 0, limit: JOB_IMAGES_PAGE_SIZE })
      .then((res) => {
        setImages(res.images)
        setImagesTotal(res.total)
      })
      .finally(() => setLoadingImages(false))
  }, [workspaceId, projectId, jobId, tab])

  function loadMoreImages() {
    if (!workspaceId || !projectId || !jobId || loadingMoreImages) return
    setLoadingMoreImages(true)
    getJobImages(workspaceId, projectId, jobId, tab, { skip: images.length, limit: JOB_IMAGES_PAGE_SIZE })
      .then((res) => setImages((prev) => [...prev, ...res.images]))
      .finally(() => setLoadingMoreImages(false))
  }

  function toggleImageSelect(id: string) {
    setSelectedImageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allSelected = images.length > 0 && selectedImageIds.length === images.length
  function toggleSelectAll() {
    setSelectedImageIds(allSelected ? [] : images.map((img) => img.id))
  }

  const progressPercent = useMemo(() => {
    if (!job || job.total_images === 0) return 0
    return Math.round((job.annotated_count / job.total_images) * 100)
  }, [job])

  function startEditingInstructions() {
    setInstructionsDraft(job?.instructions ?? "")
    setEditingInstructions(true)
  }

  async function saveInstructions() {
    if (!workspaceId || !projectId || !jobId) return
    setSavingInstructions(true)
    try {
      const res = await updateJobInstructions(workspaceId, projectId, jobId, instructionsDraft)
      setJob((prev) => (prev ? { ...prev, instructions: res.instructions } : prev))
      setEditingInstructions(false)
      refetchActivity()
    } finally {
      setSavingInstructions(false)
    }
  }

  function startEditingTitle() {
    setTitleDraft(job?.title ?? "")
    setEditingTitle(true)
  }

  async function saveTitle() {
    if (!workspaceId || !projectId || !jobId || !titleDraft.trim()) return
    setSavingTitle(true)
    try {
      const res = await updateJobTitle(workspaceId, projectId, jobId, titleDraft.trim())
      setJob((prev) => (prev ? { ...prev, title: res.title } : prev))
      setEditingTitle(false)
      refetchActivity()
    } finally {
      setSavingTitle(false)
    }
  }

  function handleImageCardClick(imageId: string) {
    if (selectedImageIds.length > 0) {
      toggleImageSelect(imageId)
      return
    }
    if (!projectId || !job) return
    navigate(`/projects/${projectId}/annotate/tool/${job.id}?image=${imageId}`)
  }

  if (!job) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border p-6">
        <p className="mb-2 text-sm font-semibold text-foreground">Progress</p>

        <div className="mb-1 flex items-center justify-between">
          <Progress value={progressPercent} className="w-full" />
        </div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{progressPercent}% complete</p>
        <p className="mb-1 text-sm font-medium text-foreground">{job.total_images} Images</p>
        <p className="text-xs text-muted-foreground">○ {job.annotated_count} Annotated</p>
        <p className="mb-5 text-xs text-muted-foreground">○ {job.unannotated_count} Unannotated</p>

        <div className="mb-5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Instructions</p>
            {!editingInstructions && (
              <button
                onClick={startEditingInstructions}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                <Pencil className="size-3" />
                Edit
              </button>
            )}
          </div>
          {editingInstructions ? (
            <InstructionsEditor
              value={instructionsDraft}
              onChange={setInstructionsDraft}
              onClose={() => setEditingInstructions(false)}
              onSave={saveInstructions}
              saving={savingInstructions}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {job.instructions || "No specific instructions were added when this job was assigned."}
            </p>
          )}
        </div>

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Assignment</p>
            <button
              onClick={() => setReassignOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <Pencil className="size-3" />
              Reassign
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {job.assignments.map((a) => (
              <div key={a.user_id} className="flex items-center gap-2.5">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-brand/15 text-xs text-brand">
                    {a.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">Labeler</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {reviewers.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-foreground">Reviewers</p>
            <div className="flex flex-col gap-2">
              {reviewers.map((r) => (
                <div key={r.user_id} className="flex items-center gap-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-brand/15 text-xs text-brand">
                      {r.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">Timeline</p>
          <div className="flex flex-col gap-3">
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              activity.map((entry) => (
                <div key={entry.id} className="flex gap-2.5">
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="bg-brand/15 text-[10px] text-brand">
                      {entry.user_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-xs text-muted-foreground">
                    <p>
                      <span className="text-foreground">{entry.user_name}</span> — {entry.action}
                    </p>
                    <p className="mt-0.5">
                      {new Date(entry.created_at).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                      ,{" "}
                      {new Date(entry.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8">
        <div className="mb-5 flex items-center justify-between">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="h-9 w-80 text-lg font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle()
                  if (e.key === "Escape") setEditingTitle(false)
                }}
              />
              <Button size="sm" variant="brand" onClick={saveTitle} disabled={savingTitle || !titleDraft.trim()}>
                {savingTitle ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingTitle(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="group flex items-center gap-1.5">
              <h1 className="text-xl font-semibold text-foreground">{job.title}</h1>
              <button
                onClick={startEditingTitle}
                className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                title="Rename job"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {tab === "unannotated" && (
              <Button variant="brand" asChild>
                <Link to={`/projects/${projectId}/annotate/tool/${job.id}`}>Start Annotating</Link>
              </Button>
            )}
            {tab === "annotated" && selectedImageIds.length > 0 && (
              <Button
                variant="outline"
                onClick={handleSendSelectedToUnannotated}
                disabled={sendingSelectedToUnannotated}
              >
                <RotateCcw className="size-4" />
                {sendingSelectedToUnannotated
                  ? "Sending…"
                  : `Send ${selectedImageIds.length} Image${selectedImageIds.length !== 1 ? "s" : ""} To Unannotated`}
              </Button>
            )}
            <Button variant="outline" onClick={() => setReviewOpen(true)}>
              Submit for Review
            </Button>
            <Button
              variant="brand"
              onClick={() => setAddToDatasetOpen(true)}
              disabled={!job.annotated_count}
            >
              <Check className="size-4" />
              {`Add ${job.annotated_count} Image${job.annotated_count !== 1 ? "s" : ""} To Dataset`}
            </Button>
            <button
              onClick={() => navigate(`/projects/${projectId}/annotate`)}
              className="ml-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-6 border-b border-border">
            <button
              onClick={() => setTab("unannotated")}
              className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                tab === "unannotated"
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Unannotated
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  tab === "unannotated" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {job.unannotated_count}
              </span>
            </button>
            <button
              onClick={() => setTab("annotated")}
              className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                tab === "annotated"
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Annotated
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  tab === "annotated" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {job.annotated_count}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              {selectedImageIds.length > 0 ? `${selectedImageIds.length} selected` : "Select all"}
            </label>
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

        {loadingImages ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : images.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No images in this tab.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {images.map((img) => {
              const selected = selectedImageIds.includes(img.id)
              const splitInfo =
                img.split === "train"
                  ? { label: "Train", icon: Activity }
                  : img.split === "valid"
                    ? { label: "Valid", icon: ShieldCheck }
                    : img.split === "test"
                      ? { label: "Test", icon: Pencil }
                      : null
              return (
                <div
                  key={img.id}
                  className="group relative flex flex-col gap-1.5 [content-visibility:auto] [contain-intrinsic-size:0_220px]"
                >
                  <div
                    onClick={() => handleImageCardClick(img.id)}
                    className={`relative aspect-[4/3] cursor-pointer overflow-hidden rounded-md border bg-muted ${
                      selected ? "border-brand ring-2 ring-brand/30" : "border-border"
                    }`}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleImageSelect(img.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1.5 right-1.5 z-10 bg-background/90 shadow-sm data-[state=unchecked]:opacity-0 group-hover:data-[state=unchecked]:opacity-100"
                    />
                    {img.thumbnail_url ? (
                      <img src={img.thumbnail_url} alt={img.filename} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        Processing…
                      </div>
                    )}
                    {splitInfo && (
                      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-brand-foreground shadow-sm">
                        <splitInfo.icon className="size-2.5" />
                        {splitInfo.label}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={img.filename}>
                    {img.filename}
                  </p>
                </div>
              )
            })}
          </div>
        )}
        {images.length > 0 && images.length < imagesTotal && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={loadMoreImages} disabled={loadingMoreImages}>
              {loadingMoreImages ? "Loading…" : `Load more (${images.length} / ${imagesTotal})`}
            </Button>
          </div>
        )}
      </div>

      <ScrollToTopButton containerRef={scrollRef} />

      {workspaceId && projectId && (
        <>
          <ReassignJobDialog
            workspaceId={workspaceId}
            projectId={projectId}
            job={job}
            open={reassignOpen}
            onOpenChange={setReassignOpen}
            onReassigned={() => {
              refetchJob()
              refetchActivity()
            }}
          />
          <AddToDatasetDialog
            workspaceId={workspaceId}
            projectId={projectId}
            jobId={job.id}
            labeledCount={job.annotated_count}
            remainingCount={job.unannotated_count}
            open={addToDatasetOpen}
            onOpenChange={setAddToDatasetOpen}
            onAdded={handleDatasetAdded}
          />
          <SubmitForReviewDialog
            workspaceId={workspaceId}
            projectId={projectId}
            jobId={job.id}
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            onSubmitted={() => {
              refetchReviewers()
              refetchActivity()
            }}
          />
        </>
      )}
    </div>
  )
}
