import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Layers,
  Check,
  Activity,
  ShieldCheck,
  Pencil,
  Plus,
  X as XIcon,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
import { useProject } from "@/hooks/useProjects"
import { listProjectImages, type ProjectImageSummary } from "@/lib/imageApi"
import { listClasses } from "@/lib/classApi"
import { listVersions, createVersion, type ProjectVersion, type PreprocessingConfig, type ResizeMode } from "@/lib/versionApi"
import { AutoOrientDialog, ResizeDialog, PreprocessingOptionsDialog } from "./PreprocessingDialogs"
import { RebalanceSplitsDialog } from "./RebalanceSplitsDialog"
import { AugmentationOptionsDialog, type AugmentationType } from "./AugmentationOptionsDialog"
import { VersionDetailView } from "./VersionDetailView"
import { VersionTrashDialog } from "./VersionTrashDialog"

const RESIZE_MODE_LABELS: Record<ResizeMode, string> = {
  stretch: "Stretch to",
  fill_center_crop: "Fill (with center crop) in",
  fit_within: "Fit within",
  fit_reflect: "Fit (reflect edges) in",
  fit_black_edges: "Fit (black edges) in",
  fit_white_edges: "Fit (white edges) in",
}

const EXTRA_PREPROCESSING_LABELS: Record<"grayscale" | "auto_contrast" | "random_sample", string> = {
  grayscale: "Grayscale",
  auto_contrast: "Auto-Adjust Contrast",
  random_sample: "Random Sample",
}

type StepNum = 1 | 2 | 3 | 4 | 5

const SPLIT_META = {
  train: { label: "Train", icon: Activity, className: "bg-brand text-brand-foreground" },
  valid: { label: "Valid", icon: ShieldCheck, className: "bg-blue-500 text-white" },
  test: { label: "Test", icon: Pencil, className: "bg-orange-500 text-white" },
} as const

function StepCircle({ state, num }: { state: "done" | "current" | "future"; num: number }) {
  if (state === "done") {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
        <Check className="size-4" />
      </div>
    )
  }
  return (
    <div
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        state === "current" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
      }`}
    >
      {num}
    </div>
  )
}

export function VersionsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const addToast = useToastStore((s) => s.addToast)
  const { project } = useProject(projectId)

  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? null
  const [trashDialogOpen, setTrashDialogOpen] = useState(false)

  const [step, setStep] = useState<StepNum>(1)
  const [versionName, setVersionName] = useState("")
  const [versionNote, setVersionNote] = useState("")
  const [creating, setCreating] = useState(false)

  const [datasetTotal, setDatasetTotal] = useState(0)
  const [classCount, setClassCount] = useState(0)
  const [previewImages, setPreviewImages] = useState<ProjectImageSummary[]>([])
  const [showAllSourcePreview, setShowAllSourcePreview] = useState(false)
  const [splitCounts, setSplitCounts] = useState<{ train: number; valid: number; test: number }>({
    train: 0,
    valid: 0,
    test: 0,
  })
  const [loadingSource, setLoadingSource] = useState(true)
  const [rebalanceDialogOpen, setRebalanceDialogOpen] = useState(false)

  const [preprocessing, setPreprocessing] = useState<PreprocessingConfig>({
    auto_orient: true,
    resize: { mode: "stretch", width: 640, height: 512 },
  })
  const [autoOrientOpen, setAutoOrientOpen] = useState(false)
  const [resizeOpen, setResizeOpen] = useState(false)
  const [preprocessingOptionsOpen, setPreprocessingOptionsOpen] = useState(false)

  const [augmentations, setAugmentations] = useState<Record<string, AugmentationType>>({})
  const [augDialogOpen, setAugDialogOpen] = useState(false)

  function refetchVersions() {
    if (!workspaceId || !projectId) return
    setLoadingVersions(true)
    listVersions(workspaceId, projectId)
      .then((data) => {
        setVersions(data)
        // Land on the latest version by default instead of always dropping
        // back to the "Create New Version" wizard — the wizard should only
        // show when explicitly requested via that button.
        setSelectedVersionId((prev) => prev ?? data[0]?.id ?? null)
      })
      .finally(() => setLoadingVersions(false))
  }

  function refetchSource() {
    if (!workspaceId || !projectId) return
    setLoadingSource(true)
    Promise.all([
      listProjectImages(workspaceId, projectId, { status: "dataset", limit: 50 }),
      listClasses(workspaceId, projectId),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "train", limit: 1 }),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "valid", limit: 1 }),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "test", limit: 1 }),
    ])
      .then(([preview, classes, train, valid, test]) => {
        setPreviewImages(preview.items)
        setDatasetTotal(preview.total)
        setClassCount(classes.length)
        setSplitCounts({ train: train.total, valid: valid.total, test: test.total })
      })
      .finally(() => setLoadingSource(false))
  }

  useEffect(refetchVersions, [workspaceId, projectId])
  useEffect(refetchSource, [workspaceId, projectId])
  useEffect(() => {
    setVersionName(`v${versions.length + 1}`)
  }, [versions.length])

  async function handleCreate() {
    if (!workspaceId || !projectId || !versionName.trim() || creating) return
    setCreating(true)
    try {
      const augmentationsPayload = Object.fromEntries(
        Object.entries(augmentations).map(([id, aug]) => [id, { label: aug.label }])
      )
      const created = await createVersion(workspaceId, projectId, {
        name: versionName.trim(),
        note: versionNote.trim() || undefined,
        preprocessing,
        augmentations: augmentationsPayload,
      })
      addToast({ variant: "success", title: "Version created", description: versionName.trim() })
      setVersionNote("")
      setStep(1)
      setVersions((prev) => [created, ...prev])
      setSelectedVersionId(created.id)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      addToast({ variant: "error", title: "Couldn't create version", description: detail ?? "Please try again." })
    } finally {
      setCreating(false)
    }
  }

  const stepState = (n: StepNum): "done" | "current" | "future" =>
    n < step ? "done" : n === step ? "current" : "future"

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-foreground px-6 py-4">
        <span className="text-lg font-semibold text-background">Versions</span>
        <Button variant="brand" onClick={() => setSelectedVersionId(null)}>
          <Plus className="size-4" />
          Create New Version
        </Button>
      </div>
      <div className="flex flex-1 overflow-hidden">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-border">
        <div className="p-3">
          {loadingVersions ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions created yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionId(v.id)}
                  className={`rounded-md border p-2.5 text-left ${
                    v.id === selectedVersionId ? "border-brand bg-brand/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <p className={`truncate text-sm font-semibold ${v.id === selectedVersionId ? "text-brand" : "text-foreground"}`}>
                    {v.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.image_count} image{v.image_count !== 1 && "s"} · {v.class_count} class{v.class_count !== 1 && "es"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setTrashDialogOpen(true)}
          className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Trash2 className="size-3.5" />
          Trash
        </button>
      </aside>

      {selectedVersionId && selectedVersion && workspaceId && projectId ? (
        <VersionDetailView
          workspaceId={workspaceId}
          projectId={projectId}
          version={selectedVersion}
          annotationType={project?.annotation_type ?? "object_detection"}
          onRenamed={(updated) => {
            setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
          }}
          onDeleted={() => {
            setVersions((prev) => prev.filter((v) => v.id !== selectedVersionId))
            setSelectedVersionId(null)
          }}
        />
      ) : (
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="mb-6 flex items-center gap-2.5 text-2xl font-semibold text-foreground">
          <Layers className="size-6" />
          Versions
        </h1>

        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Create New Version</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Prepare your images and data for training by compiling them into a version.
        </p>

        <div className="mb-6 max-w-md">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Version Name</label>
          <Input value={versionName} onChange={(e) => setVersionName(e.target.value)} />
        </div>

        <div className="flex flex-col">
          {/* Step 1 — Source Images */}
          <div className="flex gap-3 pb-6">
            <div className="flex flex-col items-center">
              <StepCircle state={stepState(1)} num={1} />
              <div className="mt-1 w-px flex-1 bg-border" />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className={`font-semibold hover:text-brand ${step === 1 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  Source Images
                </button>
              </div>

              {step === 1 ? (
                <div className="mt-3">
                  <div className="mb-3 flex flex-wrap gap-6 text-sm">
                    <span><span className="text-muted-foreground">Images:</span> <span className="font-medium text-foreground">{datasetTotal}</span></span>
                    <span><span className="text-muted-foreground">Classes:</span> <span className="font-medium text-foreground">{classCount}</span></span>
                  </div>
                  {previewImages.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {(showAllSourcePreview ? previewImages : previewImages.slice(0, 8)).map((img) => (
                        <div key={img.id} className="size-16 overflow-hidden rounded bg-muted">
                          {img.thumbnail_url && (
                            <img src={img.thumbnail_url} alt={img.filename} className="size-full object-cover" />
                          )}
                        </div>
                      ))}
                      {previewImages.length > 8 && (
                        <button
                          onClick={() => setShowAllSourcePreview((v) => !v)}
                          className="flex size-16 items-center justify-center rounded border border-dashed border-border text-xs font-medium text-brand hover:bg-accent"
                        >
                          {showAllSourcePreview ? "Show Less" : `+${previewImages.length - 8} More`}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="brand" onClick={() => setStep(2)} disabled={loadingSource || datasetTotal === 0}>
                      Continue
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/upload`)}>
                      <Plus className="size-3.5" />
                      Add More Images
                    </Button>
                  </div>
                  {!loadingSource && datasetTotal === 0 && (
                    <p className="mt-2 text-xs text-destructive">
                      No images in the dataset yet — add annotated images to it from the Annotate page first.
                    </p>
                  )}
                </div>
              ) : step > 1 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {datasetTotal} images · {classCount} classes
                </p>
              ) : null}
            </div>
          </div>

          {/* Step 2 — Train/Test Split */}
          <div className="flex gap-3 pb-6">
            <div className="flex flex-col items-center">
              <StepCircle state={stepState(2)} num={2} />
              <div className="mt-1 w-px flex-1 bg-border" />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(2)}
                  className={`font-semibold hover:text-brand ${step === 2 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  Train/Test Split
                </button>
              </div>

              {step === 2 ? (
                <div className="mt-3">
                  <div className="mb-4 rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      {(["train", "valid", "test"] as const).map((s) => {
                        const meta = SPLIT_META[s]
                        const count = splitCounts[s]
                        const pct = datasetTotal > 0 ? Math.round((count / datasetTotal) * 100) : 0
                        return (
                          <span key={s} className="flex items-center gap-1.5">
                            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                              <meta.icon className="size-3" />
                              {meta.label}
                            </span>
                            <span className="text-muted-foreground">{pct}% · {count}</span>
                          </span>
                        )
                      })}
                    </div>
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="bg-brand" style={{ width: `${datasetTotal ? (splitCounts.train / datasetTotal) * 100 : 0}%` }} />
                      <div className="bg-blue-500" style={{ width: `${datasetTotal ? (splitCounts.valid / datasetTotal) * 100 : 0}%` }} />
                      <div className="bg-orange-500" style={{ width: `${datasetTotal ? (splitCounts.test / datasetTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button variant="brand" onClick={() => setStep(3)}>Continue</Button>
                    <Button
                      variant="outline"
                      className="ml-auto"
                      onClick={() => setRebalanceDialogOpen(true)}
                      disabled={datasetTotal === 0}
                    >
                      Rebalance
                    </Button>
                  </div>
                </div>
              ) : step > 2 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Train {splitCounts.train} · Valid {splitCounts.valid} · Test {splitCounts.test}
                </p>
              ) : null}
            </div>
          </div>

          {/* Step 3 — Preprocessing */}
          <div className="flex gap-3 pb-6">
            <div className="flex flex-col items-center">
              <StepCircle state={stepState(3)} num={3} />
              <div className="mt-1 w-px flex-1 bg-border" />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(3)}
                  className={`font-semibold hover:text-brand ${step === 3 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  Preprocessing
                </button>
              </div>

              {step === 3 ? (
                <div className="mt-3">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Decrease training time and increase performance by applying image transformations to all images
                    in this dataset. These settings are saved with the version but not yet applied to the actual
                    image files — real pixel processing isn't wired up.
                  </p>
                  <div className="mb-4 divide-y divide-border rounded-lg border border-border">
                    {preprocessing.auto_orient && (
                      <div className="flex items-center justify-between p-3">
                        <span className="text-sm font-medium text-foreground">Auto-Orient</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setAutoOrientOpen(true)} className="text-xs font-medium text-brand hover:underline">
                            Edit
                          </button>
                          <button
                            onClick={() => setPreprocessing((p) => ({ ...p, auto_orient: false }))}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    {preprocessing.resize && (
                      <div className="flex items-center justify-between p-3">
                        <div>
                          <span className="text-sm font-medium text-foreground">Resize</span>
                          <p className="text-xs text-muted-foreground">
                            {RESIZE_MODE_LABELS[preprocessing.resize.mode]} {preprocessing.resize.width}×{preprocessing.resize.height}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setResizeOpen(true)} className="text-xs font-medium text-brand hover:underline">
                            Edit
                          </button>
                          <button
                            onClick={() => setPreprocessing((p) => ({ ...p, resize: null }))}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    {(["grayscale", "auto_contrast", "random_sample"] as const).map((id) =>
                      preprocessing[id] ? (
                        <div key={id} className="flex items-center justify-between p-3">
                          <span className="text-sm font-medium text-foreground">{EXTRA_PREPROCESSING_LABELS[id]}</span>
                          <button
                            onClick={() => setPreprocessing((p) => ({ ...p, [id]: false }))}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      ) : null
                    )}
                    {!preprocessing.auto_orient &&
                      !preprocessing.resize &&
                      !preprocessing.grayscale &&
                      !preprocessing.auto_contrast &&
                      !preprocessing.random_sample && (
                        <p className="p-3 text-sm text-muted-foreground">No preprocessing steps.</p>
                      )}
                    <button
                      onClick={() => setPreprocessingOptionsOpen(true)}
                      className="flex w-full items-center justify-center gap-1.5 p-3 text-sm text-muted-foreground hover:bg-accent"
                    >
                      <Plus className="size-3.5" />
                      Add Preprocessing Step
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                    <Button variant="brand" onClick={() => setStep(4)}>Continue</Button>
                  </div>
                </div>
              ) : step > 3 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {[
                    preprocessing.auto_orient && "Auto-Orient",
                    preprocessing.resize &&
                      `Resize ${preprocessing.resize.width}×${preprocessing.resize.height}`,
                    preprocessing.grayscale && "Grayscale",
                    preprocessing.auto_contrast && "Auto-Adjust Contrast",
                    preprocessing.random_sample && "Random Sample",
                  ]
                    .filter(Boolean)
                    .join(", ") || "No preprocessing steps"}
                </p>
              ) : null}
            </div>
          </div>

          {/* Step 4 — Augmentation */}
          <div className="flex gap-3 pb-6">
            <div className="flex flex-col items-center">
              <StepCircle state={stepState(4)} num={4} />
              <div className="mt-1 w-px flex-1 bg-border" />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(4)}
                  className={`font-semibold hover:text-brand ${step === 4 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  Augmentation
                </button>
              </div>

              {step === 4 ? (
                <div className="mt-3">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Create new training examples by generating augmented versions of each image. These are saved
                    with the version as configuration, not yet actually applied to image files.
                  </p>
                  {Object.keys(augmentations).length > 0 && (
                    <div className="mb-4 divide-y divide-border rounded-lg border border-border">
                      {Object.entries(augmentations).map(([id, aug]) => (
                        <div key={id} className="flex items-center justify-between p-3">
                          <span className="text-sm font-medium text-foreground">{aug.label}</span>
                          <button
                            onClick={() =>
                              setAugmentations((prev) => {
                                const next = { ...prev }
                                delete next[id]
                                return next
                              })
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setAugDialogOpen(true)}
                    className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-accent"
                  >
                    <Plus className="size-3.5" />
                    Add Augmentation Step
                  </button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
                    <Button variant="brand" onClick={() => setStep(5)}>Continue</Button>
                  </div>
                </div>
              ) : step > 4 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {Object.keys(augmentations).length > 0
                    ? Object.values(augmentations).map((a) => a.label).join(", ")
                    : "Turned Off"}
                </p>
              ) : null}
            </div>
          </div>

          {/* Step 5 — Create */}
          <div className="flex gap-3">
            <StepCircle state={stepState(5)} num={5} />
            <div className="flex-1">
              <button
                onClick={() => setStep(5)}
                className={`font-semibold hover:text-brand ${step === 5 ? "text-foreground" : "text-muted-foreground"}`}
              >
                Create
              </button>

              {step === 5 && (
                <div className="mt-3">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Review your selections then click "Create" to snapshot the current dataset into this version.
                  </p>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Version Notes</label>
                  <textarea
                    value={versionNote}
                    onChange={(e) => setVersionNote(e.target.value)}
                    placeholder="Add any version notes here…"
                    rows={3}
                    className="mb-4 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(4)} disabled={creating}>Back</Button>
                    <Button variant="brand" onClick={handleCreate} disabled={creating || !versionName.trim()}>
                      {creating ? "Creating…" : "Create"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
      </div>

      <AutoOrientDialog
        open={autoOrientOpen}
        onOpenChange={setAutoOrientOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        onApply={() => setPreprocessing((p) => ({ ...p, auto_orient: true }))}
      />
      <ResizeDialog
        open={resizeOpen}
        onOpenChange={setResizeOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        initialMode={preprocessing.resize?.mode ?? "stretch"}
        initialWidth={preprocessing.resize?.width ?? 640}
        initialHeight={preprocessing.resize?.height ?? 512}
        onApply={(config) => setPreprocessing((p) => ({ ...p, resize: config }))}
      />
      <PreprocessingOptionsDialog
        open={preprocessingOptionsOpen}
        onOpenChange={setPreprocessingOptionsOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        onSelect={(id) => setPreprocessing((p) => ({ ...p, [id]: true }))}
      />

      {workspaceId && projectId && (
        <RebalanceSplitsDialog
          workspaceId={workspaceId}
          projectId={projectId}
          datasetTotal={datasetTotal}
          initialCounts={splitCounts}
          open={rebalanceDialogOpen}
          onOpenChange={setRebalanceDialogOpen}
          onRebalanced={setSplitCounts}
        />
      )}

      <AugmentationOptionsDialog
        open={augDialogOpen}
        onOpenChange={setAugDialogOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        onSelect={(aug) => setAugmentations((prev) => ({ ...prev, [aug.id]: aug }))}
      />

      {workspaceId && projectId && (
        <VersionTrashDialog
          workspaceId={workspaceId}
          projectId={projectId}
          open={trashDialogOpen}
          onOpenChange={setTrashDialogOpen}
          onRestored={(restored) => {
            setVersions((prev) => [restored, ...prev])
            setSelectedVersionId(restored.id)
          }}
        />
      )}
    </div>
  )
}
