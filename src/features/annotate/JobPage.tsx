import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { X, Pencil, Check, RotateCcw, Activity, ShieldCheck, ThumbsUp, ThumbsDown, Send } from "lucide-react"
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
  reviewJobImages,
} from "@/lib/jobApi"
import { listProjectMembers } from "@/lib/projectApi"
import { sendImageToUnannotated } from "@/lib/commentApi"
import { InstructionsEditor } from "@/components/shared/InstructionsEditor"
import { ScrollToTopButton } from "@/components/shared/ScrollToTopButton"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
import { useAuthStore } from "@/stores/authStore"
import { useProject } from "@/hooks/useProjects"
import { PageLoader } from "@/components/shared/PageLoader"
import { extractErrorMessage } from "@/lib/utils"
import { ReassignJobDialog } from "./ReassignJobDialog"
import { SubmitForReviewDialog } from "./SubmitForReviewDialog"
import { AddToDatasetDialog } from "./AddToDatasetDialog"
import type { JobDetail, JobImageSummary, JobActivityEntry, JobReviewerSummary } from "@/types/job"

type Tab = "unannotated" | "annotated" | "approved"

export function JobPage() {
  const { projectId, jobId } = useParams<{ projectId: string; jobId: string }>()
  const navigate = useNavigate()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const { project } = useProject(projectId)
  // A Reviewer can approve/reject and edit instructions, but can't assign,
  // reassign, or start annotating themselves — same flag ProjectSidebar.tsx
  // and AnnotatePage.tsx already key off.
  const canAnnotate = project?.my_permissions?.annotate !== false
  // A Labeler's own image list is already forced server-side to just their
  // assigned slice, so a labeler-picker would be inert for them — only show
  // it to whoever can actually see the whole job (Admin/Reviewer/SA).
  const showLabelerFilter = project?.my_role !== "labeler"
  const [labelerFilter, setLabelerFilter] = useState<string>("all")
  // Whoever's viewing this job is very often also one of its own labelers
  // (e.g. a Reviewer or Admin/SA who's also been assigned images here,
  // exactly like Abhidha on Nexus1) — defaulting the filter to "All" made
  // the very first thing they saw be everyone's combined 9000+ image count
  // instead of their own actual work. Set once, the first time job data
  // (with assignments) arrives — a `ref` guard so it never fights a
  // filter the person then deliberately changes themselves afterward.
  const defaultLabelerFilterSet = useRef(false)
  // Same idea as showLabelerFilter, but for narrowing the review queue to
  // one reviewer's exclusive slice — a Reviewer's own view is already
  // forced server-side to just their assigned slice, so this picker would
  // be inert for them too.
  const showReviewerFilter = project?.my_role !== "reviewer"
  const [reviewerFilter, setReviewerFilter] = useState<string>("all")

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
  const [reviewing, setReviewing] = useState(false)
  // Whether the PROJECT has anyone with the reviewer role at all — distinct
  // from `reviewers` above (who's already been submitted-to on THIS job).
  // "Submit for Review" is pointless to show when this is empty: the dialog
  // it opens can only ever say "No reviewers on this project yet."
  const [projectHasReviewers, setProjectHasReviewers] = useState(false)

  const currentUserId = useAuthStore((s) => s.user?.id)
  const isSuperAdmin = useAuthStore((s) => s.user?.role === "super_admin")
  // Whether the current viewer is themselves one of this job's labelers —
  // drives two things below: which role gets the labeler filter defaulted
  // to "just me", and (for a Reviewer specifically) whether the filter is
  // even worth showing at all. See is_job_assignee/own_slice in
  // get_job_images (app/jobs/route.py) — the backend condition this mirrors.
  const isSelfAssignedToJob = job?.assignments.some((a) => a.user_id === currentUserId) ?? false
  // A Reviewer who's also a job assignee gets get_job_images' own_slice
  // union (their own submissions OR whatever's routed to them to review) —
  // the assigned_to param this dropdown drives is silently ignored for them
  // on every tab, so showing it (defaulted to their own name, no less) was
  // actively misleading: it implied "only my images" while the grid kept
  // showing everyone's review-routed work too, exactly what surfaced this.
  const labelerFilterInertForViewer = project?.my_role === "reviewer" && isSelfAssignedToJob
  // Only whoever currently owns the instructions (or an Admin/SA) can edit
  // or clear them — see _check_can_edit_instructions on the backend. A job
  // whose instructions have no recorded author yet (never written, or
  // predates this tracking) has nobody to restrict against.
  // Review is opt-in per job (via "Submit for Review") — everything below
  // only changes shape once at least one reviewer is actually attached, so
  // a job with none behaves exactly as it did before review existed.
  const hasReviewers = reviewers.length > 0
  const isReviewerHere = reviewers.some((r) => r.user_id === currentUserId)
  // A Reviewer has project-wide oversight — they can review ANY job, not
  // just ones someone specifically "Submit for Review"-ed to them (they
  // can't even see that button, see canAnnotate above). So the review UI
  // (To Do/Approved tabs, review filtering, Approve/Reject controls) turns
  // on either the old way (this job has a formal invite) OR simply because
  // the viewer's own project role is Reviewer.
  const isReviewerRole = project?.my_role === "reviewer"
  const reviewUiActive = hasReviewers || isReviewerRole

  // A Reviewer's own "to do" is the review queue, not the labeler's
  // unannotated queue — so their default landing tab is the pending-review
  // set (the "annotated" tab value, relabeled "To Do" for them below), not
  // "unannotated" like every other role. `isReviewerRole` starts false
  // until `project` loads, so this fires once as soon as it flips true
  // rather than being decided at initial useState time.
  useEffect(() => {
    if (isReviewerRole) setTab("annotated")
  }, [isReviewerRole])

  function refetchJob() {
    if (!workspaceId || !projectId || !jobId) return
    getJob(
      workspaceId, projectId, jobId,
      labelerFilter === "all" ? undefined : labelerFilter,
      reviewerFilter === "all" ? undefined : reviewerFilter
    ).then(setJob)
  }

  useEffect(() => {
    if (defaultLabelerFilterSet.current || !job || !currentUserId || !project) return
    defaultLabelerFilterSet.current = true
    // Admin/SA deliberately excluded — their whole point is full-job
    // oversight, and unlike a self-assigned Reviewer (where the filter is
    // inert anyway, see labelerFilterInertForViewer), it's NOT ignored for
    // them: defaulting an Admin/SA to "just me" would silently hide
    // everyone else's images the moment they land on the page, which is
    // exactly the regression this guard exists to prevent.
    if (project.my_role !== "admin" && project.my_role !== "super_admin" && isSelfAssignedToJob) {
      setLabelerFilter(currentUserId)
    }
  }, [job, currentUserId, project, isSelfAssignedToJob])

  // Navigating straight from one job to another (JobPage stays mounted,
  // only `jobId` changes) must re-arm the one-time default above — without
  // this, the ref from the PREVIOUS job would block it forever, silently
  // carrying that job's filter choice into a job where it may not even
  // correspond to a real assignee.
  useEffect(() => {
    defaultLabelerFilterSet.current = false
    setLabelerFilter("all")
  }, [jobId])

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

  useEffect(refetchJob, [workspaceId, projectId, jobId, labelerFilter, reviewerFilter])
  useEffect(refetchActivity, [workspaceId, projectId, jobId])
  useEffect(refetchReviewers, [workspaceId, projectId, jobId])

  useEffect(() => {
    if (!workspaceId || !projectId) return
    listProjectMembers(workspaceId, projectId, "reviewer")
      .then((members) => setProjectHasReviewers(members.length > 0))
      .catch(() => {})
  }, [workspaceId, projectId])

  const JOB_IMAGES_PAGE_SIZE = 60

  // "approved" is a UI-only tab — the API models it as tab=annotated plus a
  // review filter, not a third tab value of its own (see get_job_images).
  // "annotated" itself only filters to review=pending once reviewers exist;
  // with none attached it stays every annotated image, unchanged from
  // before review existed at all.
  function apiTabParams(t: Tab): { apiTab: "unannotated" | "annotated"; review?: "pending" | "approved" } {
    if (t === "unannotated") return { apiTab: "unannotated" }
    if (t === "approved") return { apiTab: "annotated", review: "approved" }
    return { apiTab: "annotated", review: reviewUiActive ? "pending" : undefined }
  }

  useEffect(() => {
    if (!workspaceId || !projectId || !jobId) return
    // `tab` briefly starts at "unannotated" (its initial value) for a
    // Reviewer too, until isReviewerRole resolves async and the other
    // effect below flips it to "annotated" — that's two fetches in quick
    // succession, and with no guard here, whichever happened to resolve
    // LAST wins regardless of which one was actually still relevant. That
    // race is exactly what let a stale "unannotated" response land after
    // the correct "annotated" one, showing the wrong images under the
    // right-looking tab label until a reload happened to avoid the race.
    let cancelled = false
    setLoadingImages(true)
    setSelectedImageIds([])
    const { apiTab, review } = apiTabParams(tab)
    const assignedTo = labelerFilter === "all" ? undefined : labelerFilter
    const reviewerId = reviewerFilter === "all" ? undefined : reviewerFilter
    getJobImages(
      workspaceId, projectId, jobId, apiTab,
      { skip: 0, limit: JOB_IMAGES_PAGE_SIZE }, review, assignedTo, reviewerId
    )
      .then((res) => {
        if (cancelled) return
        setImages(res.images)
        setImagesTotal(res.total)
      })
      .finally(() => {
        if (!cancelled) setLoadingImages(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, jobId, tab, reviewUiActive, labelerFilter, reviewerFilter])

  function loadMoreImages() {
    if (!workspaceId || !projectId || !jobId || loadingMoreImages) return
    setLoadingMoreImages(true)
    const { apiTab, review } = apiTabParams(tab)
    const assignedTo = labelerFilter === "all" ? undefined : labelerFilter
    const reviewerId = reviewerFilter === "all" ? undefined : reviewerFilter
    getJobImages(
      workspaceId, projectId, jobId, apiTab,
      { skip: images.length, limit: JOB_IMAGES_PAGE_SIZE }, review, assignedTo, reviewerId
    )
      .then((res) => setImages((prev) => [...prev, ...res.images]))
      .finally(() => setLoadingMoreImages(false))
  }

  async function handleReviewAction(action: "approve" | "reject") {
    if (!workspaceId || !projectId || !jobId || selectedImageIds.length === 0 || reviewing) return
    setReviewing(true)
    try {
      await reviewJobImages(workspaceId, projectId, jobId, selectedImageIds, action)
      addToast({
        variant: "success",
        title: action === "approve" ? "Approved" : "Sent back for changes",
        description: `${selectedImageIds.length} image${selectedImageIds.length !== 1 ? "s" : ""}`,
      })
      setImages((prev) => prev.filter((img) => !selectedImageIds.includes(img.id)))
      setSelectedImageIds([])
      refetchJob()
      refetchReviewers()
      refetchActivity()
    } catch (err) {
      addToast({
        variant: "error",
        title: `Couldn't ${action === "approve" ? "approve" : "reject"} these images`,
        description: extractErrorMessage(err),
      })
    } finally {
      setReviewing(false)
    }
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

  const canEditInstructions =
    isSuperAdmin ||
    project?.my_role === "admin" ||
    !job?.instructions_updated_by ||
    job.instructions_updated_by === currentUserId

  function startEditingInstructions() {
    setInstructionsDraft(job?.instructions ?? "")
    setEditingInstructions(true)
  }

  async function saveInstructions() {
    if (!workspaceId || !projectId || !jobId) return
    setSavingInstructions(true)
    try {
      await updateJobInstructions(workspaceId, projectId, jobId, instructionsDraft)
      // A plain { instructions } patch would drop who-set-this attribution —
      // refetch the full job so instructions_updated_by_name comes along too.
      refetchJob()
      setEditingInstructions(false)
      refetchActivity()
    } catch (err) {
      addToast({
        variant: "error",
        title: "Couldn't save instructions",
        description: extractErrorMessage(err),
      })
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
    // A Reviewer never opens the annotation tool (they can't save changes
    // there anyway — the backend blocks it) — every click just toggles
    // selection for them, across all three tabs, so their whole workflow
    // is "select, then Approve/Reject" rather than accidentally landing in
    // an editor they can't use.
    if (selectedImageIds.length > 0 || !canAnnotate) {
      toggleImageSelect(imageId)
      return
    }
    if (!projectId || !job) return
    navigate(`/projects/${projectId}/annotate/tool/${job.id}?image=${imageId}`)
  }

  if (!job) {
    return (
      <div className="flex flex-1 overflow-hidden">
        <PageLoader variant="fill" />
      </div>
    )
  }

  // Every image here has already been promoted to the dataset — this card
  // is a historical record, not an active work queue anymore. Annotate/
  // review actions on it can only ever fail (their own images no longer
  // match ANNOTATED status server-side), so they're hidden rather than
  // shown-and-broken.
  const isDatasetStage = job.stage === "dataset"

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
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" /> {job.approved_count} Approved
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-orange-500" /> {job.rejected_count} Rejected
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full border border-muted-foreground" /> {job.pending_review_count} Annotated
        </p>
        <p className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full border border-muted-foreground" /> {job.unannotated_count} Unannotated
        </p>

        <div className="mb-5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Instructions</p>
            {!editingInstructions && canEditInstructions && (
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
            <>
              <p className="text-sm text-muted-foreground">
                {job.instructions || "No specific instructions were added when this job was assigned."}
              </p>
              {job.instructions && job.instructions_updated_by_name && (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  — added by {job.instructions_updated_by_name}
                </p>
              )}
            </>
          )}
        </div>

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Assignment</p>
            {canAnnotate && !isDatasetStage && (
              <button
                onClick={() => setReassignOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                <Pencil className="size-3" />
                Reassign
              </button>
            )}
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
                    {/* Their own exclusive slice of this job's images — the
                        concrete answer to "which images are assigned to
                        this reviewer", not just a name + one overall status. */}
                    <p className="text-xs text-muted-foreground">
                      {r.pending} pending · {r.approved} approved · {r.rejected} rejected
                    </p>
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
            {tab === "unannotated" && canAnnotate && !isDatasetStage && (
              <Button variant="brand" asChild>
                <Link to={`/projects/${projectId}/annotate/tool/${job.id}`}>Start Annotating</Link>
              </Button>
            )}
            {tab === "annotated" && selectedImageIds.length > 0 && !isDatasetStage && (
              isReviewerRole || (hasReviewers && isReviewerHere) ? (
                <>
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => handleReviewAction("reject")}
                    disabled={reviewing}
                  >
                    <ThumbsDown className="size-4" />
                    {reviewing ? "Working…" : `Reject ${selectedImageIds.length}`}
                  </Button>
                  <Button variant="brand" onClick={() => handleReviewAction("approve")} disabled={reviewing}>
                    <ThumbsUp className="size-4" />
                    {reviewing ? "Working…" : `Approve ${selectedImageIds.length}`}
                  </Button>
                </>
              ) : (
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
              )
            )}
            {tab === "approved" && selectedImageIds.length > 0 && !isDatasetStage && (isReviewerRole || (hasReviewers && isReviewerHere)) && (
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => handleReviewAction("reject")}
                disabled={reviewing}
              >
                <ThumbsDown className="size-4" />
                {reviewing ? "Working…" : `Reject ${selectedImageIds.length}`}
              </Button>
            )}
            {canAnnotate && projectHasReviewers && !isDatasetStage && (
              <Button variant="outline" onClick={() => setReviewOpen(true)}>
                Submit for Review
              </Button>
            )}
            {canAnnotate && !isDatasetStage && (
              <Button
                variant="brand"
                onClick={() => setAddToDatasetOpen(true)}
                // Gated on projectHasReviewers (does the PROJECT have any
                // reviewer-capable member at all), not this job's own
                // hasReviewers (has this specific job been formally
                // Submitted for Review yet). The backend's mandatory-review
                // block (_dataset_blocked_image_ids) checks the same
                // project-wide thing — a job that was never submitted but
                // sits in a project with reviewers still 400s on any
                // not-yet-approved image, so gating this button on the
                // narrower per-job flag let SA/Admin/Labeler alike see an
                // enabled "Add N Images" button that was guaranteed to fail.
                disabled={!(projectHasReviewers ? job.approved_count : job.annotated_count)}
              >
                <Check className="size-4" />
                {projectHasReviewers
                  ? `Add ${job.approved_count} Approved Image${job.approved_count !== 1 ? "s" : ""} To Dataset`
                  : `Add ${job.annotated_count} Image${job.annotated_count !== 1 ? "s" : ""} To Dataset`}
              </Button>
            )}
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
            {(() => {
              // A Reviewer's "To Do" is THEIR queue — images the labeler
              // already sent for review — not the labeler's own unannotated
              // queue, so for them this tab (value "annotated") leads, and
              // the plain unannotated tab trails as a view-only reference
              // of what the labeler hasn't gotten to yet. Everyone else
              // keeps the original order (unannotated leads).
              const unannotatedBtn = (
                <button
                  key="unannotated"
                  onClick={() => setTab("unannotated")}
                  className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                    tab === "unannotated"
                      ? "border-brand text-brand"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isReviewerRole ? "Unannotated" : reviewUiActive ? "To Do" : "Unannotated"}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      tab === "unannotated" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {job.unannotated_count}
                  </span>
                </button>
              )
              const annotatedBtn = (
                <button
                  key="annotated"
                  onClick={() => setTab("annotated")}
                  className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                    tab === "annotated"
                      ? "border-brand text-brand"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isReviewerRole ? "To Do" : "Annotated"}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      tab === "annotated" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {reviewUiActive ? job.pending_review_count : job.annotated_count}
                  </span>
                </button>
              )
              return isReviewerRole ? [annotatedBtn, unannotatedBtn] : [unannotatedBtn, annotatedBtn]
            })()}
            {reviewUiActive && (
              <button
                onClick={() => setTab("approved")}
                className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  tab === "approved"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Approved
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    tab === "approved" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {job.approved_count}
                </span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              {selectedImageIds.length > 0 ? `${selectedImageIds.length} selected` : "Select all"}
            </label>
            {showLabelerFilter && !labelerFilterInertForViewer && job.assignments.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">Labeler:</span>
                <Select value={labelerFilter} onValueChange={setLabelerFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All labelers</SelectItem>
                    {job.assignments.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {showReviewerFilter && (tab === "annotated" || tab === "approved") && reviewers.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">Reviewer:</span>
                <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All reviewers</SelectItem>
                    {reviewers.map((r) => (
                      <SelectItem key={r.user_id} value={r.user_id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
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

        {(() => {
          if (tab !== "annotated" || !currentUserId) return null
          const myReviewerRow = reviewers.find((r) => r.user_id === currentUserId)
          if (!myReviewerRow || myReviewerRow.pending === 0) return null
          return (
            <div className="mb-4 flex items-center gap-2.5 rounded-lg border-l-4 border-brand bg-muted p-3 text-sm">
              <Send className="size-4 shrink-0 text-brand" />
              <p className="text-foreground">
                <span className="font-medium">{myReviewerRow.assigned_by_name ?? "Someone"}</span> submitted{" "}
                <span className="font-medium">{myReviewerRow.pending}</span> image
                {myReviewerRow.pending !== 1 && "s"} for your review
                {myReviewerRow.created_at &&
                  ` on ${new Date(myReviewerRow.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}`}
                .
              </p>
            </div>
          )
        })()}

        {loadingImages ? (
          <PageLoader />
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
            labeledCount={projectHasReviewers ? job.approved_count : job.annotated_count}
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
