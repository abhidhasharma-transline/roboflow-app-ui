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
import {
  listVersions, createVersion,
  type ProjectVersion, type PreprocessingConfig, type ResizeMode, type AutoContrastType,
} from "@/lib/versionApi"
import {
  AutoOrientDialog, ResizeDialog, PreprocessingOptionsDialog, AutoContrastDialog, RandomSampleDialog,
  AUTO_CONTRAST_TYPE_LABELS,
} from "./PreprocessingDialogs"
import { RebalanceSplitsDialog } from "./RebalanceSplitsDialog"
import { AugmentationOptionsDialog, type AugmentationType } from "./AugmentationOptionsDialog"
import {
  SliderAugmentationDialog, FlipDialog, BrightnessDialog,
  Rotate90Dialog, ShearDialog, CropDialog, GrayscaleAugDialog,
} from "./AugmentationDialogs"
import { preprocessingPreviewStyle } from "@/lib/versionPreview"
import { PageLoader } from "@/components/shared/PageLoader"
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

// Matches Roboflow's own default: a timestamp shown as a placeholder (not a
// pre-filled value) — the field starts empty and this is just the name that
// gets used if the user never types their own. The "v1"/"v2"/"v3" ordinal
// badge next to the name (see VersionImagesPage.tsx's `ordinals` map) is
// what actually tells creation order apart — the name itself stays the
// timestamp.
function defaultVersionName() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  let h = now.getHours()
  const ampm = h >= 12 ? "pm" : "am"
  h = h % 12 || 12
  const min = String(now.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${d} ${h}:${min}${ampm}`
}

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
  const [versionNamePlaceholder, setVersionNamePlaceholder] = useState(defaultVersionName)
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

  // No resize by default — the FIRST version a project ever creates should
  // capture images at their real, native resolution unless someone
  // explicitly opts into downsizing. A hardcoded 640x512 here (or in
  // resetVersionWizard below) meant every brand-new project's first version
  // silently downsampled regardless of what the source images actually were.
  const [preprocessing, setPreprocessing] = useState<PreprocessingConfig>({
    auto_orient: true,
    resize: null,
  })
  const [autoOrientOpen, setAutoOrientOpen] = useState(false)
  const [resizeOpen, setResizeOpen] = useState(false)
  const [preprocessingOptionsOpen, setPreprocessingOptionsOpen] = useState(false)
  const [autoContrastOpen, setAutoContrastOpen] = useState(false)
  const [randomSampleOpen, setRandomSampleOpen] = useState(false)

  const [augmentations, setAugmentations] = useState<Record<string, AugmentationType>>({})
  const [augDialogOpen, setAugDialogOpen] = useState(false)
  const [flipOpen, setFlipOpen] = useState(false)
  const [hueOpen, setHueOpen] = useState(false)
  const [rotationOpen, setRotationOpen] = useState(false)
  const [saturationOpen, setSaturationOpen] = useState(false)
  const [exposureOpen, setExposureOpen] = useState(false)
  const [brightnessOpen, setBrightnessOpen] = useState(false)
  const [blurOpen, setBlurOpen] = useState(false)
  const [rotate90Open, setRotate90Open] = useState(false)
  const [shearOpen, setShearOpen] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [noiseOpen, setNoiseOpen] = useState(false)
  const [grayscaleAugOpen, setGrayscaleAugOpen] = useState(false)

  // Shared by the picker tile's onSelect (open instead of instant-apply)
  // and the review step's "Edit" link (reopen with the values already
  // chosen) — all 12 configurable augmentation types have a real
  // configuration dialog now.
  const AUGMENTATION_DIALOG_OPENERS: Record<string, () => void> = {
    flip: () => setFlipOpen(true),
    hue: () => setHueOpen(true),
    rotation: () => setRotationOpen(true),
    saturation: () => setSaturationOpen(true),
    exposure: () => setExposureOpen(true),
    brightness: () => setBrightnessOpen(true),
    blur: () => setBlurOpen(true),
    rotate90: () => setRotate90Open(true),
    shear: () => setShearOpen(true),
    crop: () => setCropOpen(true),
    noise: () => setNoiseOpen(true),
    grayscale: () => setGrayscaleAugOpen(true),
  }

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

  // While any version is still generating its augmented images in the
  // background, poll for updates — this is the only way the "Generating…"
  // banner (VersionDetailView) and the Download button's disabled state
  // ever find out the job finished, short of a manual page refresh.
  const isGenerating = versions.some((v) => v.augmentation_status === "pending" || v.augmentation_status === "processing")
  useEffect(() => {
    if (!isGenerating || !workspaceId || !projectId) return
    const interval = setInterval(() => {
      listVersions(workspaceId, projectId).then(setVersions).catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [isGenerating, workspaceId, projectId])

  // Full reset for the wizard — called whenever "Create New Version" is
  // clicked, so re-clicking it always lands on a visibly fresh step 1
  // instead of silently reusing whatever step/name was left over from a
  // previous, abandoned attempt (confusing — looked like the click did
  // nothing). Takes the version list explicitly rather than always reading
  // component state: right after creating a version, `versions` state
  // hasn't re-rendered yet (setVersions is async), so a caller that just
  // created one passes `[created, ...versions]` itself instead of this
  // silently seeing a stale, one-version-behind list.
  function resetVersionWizard(existingVersions: ProjectVersion[] = versions) {
    setStep(1)
    setVersionName("")
    setVersionNamePlaceholder(defaultVersionName())
    setVersionNote("")
    // Only the resize target carries over from the most recent version —
    // re-typing the same width/height for every new version was the actual
    // complaint. Grayscale/auto-contrast/random-sample are per-version
    // choices that don't default to "on" just because a previous version
    // happened to use them; each new version starts without them, same as
    // before this change.
    //
    // The very first version a project ever creates has no prior version to
    // inherit from, so it defaults to no resize at all (native resolution) —
    // NOT a hardcoded 640x512. And when a prior version DID exist but had
    // resize turned off, that's a real, intentional choice to carry
    // forward too: `?? {640x512}` here would have quietly reintroduced a
    // resize the person had deliberately removed, since `null` (off) and
    // `undefined` (no prior version at all) both pass a bare `??` check.
    const previousResize = existingVersions.length > 0
      ? (existingVersions[0]?.preprocessing?.resize ?? null)
      : null
    setPreprocessing({
      auto_orient: true,
      resize: previousResize,
    })
    setAugmentations({})
  }

  async function handleCreate() {
    if (!workspaceId || !projectId || creating) return
    const resolvedName = versionName.trim() || versionNamePlaceholder
    setCreating(true)
    try {
      // `params` (the chosen slider value / checkboxes for Flip, Hue,
      // Rotation, Saturation, Exposure, Brightness, Blur) has to make it
      // into the payload too — dropping it here (as this used to) meant
      // the backend never saw anything but "this type is on", and fell
      // back to its own old fixed default range no matter what the user
      // picked in the dialog.
      const augmentationsPayload = Object.fromEntries(
        Object.entries(augmentations).map(([id, aug]) => [
          id,
          aug.params ? { label: aug.label, params: aug.params } : { label: aug.label },
        ])
      )
      const created = await createVersion(workspaceId, projectId, {
        name: resolvedName,
        note: versionNote.trim() || undefined,
        preprocessing,
        augmentations: augmentationsPayload,
      })
      addToast({ variant: "success", title: "Version created", description: resolvedName })
      resetVersionWizard([created, ...versions])
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

  // Augmentation runs AFTER preprocessing (both in the real export pipeline
  // and in the wizard's own step order) — every augmentation dialog's
  // preview should show whatever grayscale/contrast was already chosen,
  // not silently revert to the untouched original.
  const augmentationPreviewBase = preprocessingPreviewStyle(preprocessing)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-foreground px-6 py-4">
        <span className="text-lg font-semibold text-background">Versions</span>
        <Button
          variant="brand"
          onClick={() => {
            resetVersionWizard()
            setSelectedVersionId(null)
          }}
        >
          <Plus className="size-4" />
          Create New Version
        </Button>
      </div>
      <div className="flex flex-1 overflow-hidden">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-border">
        <div className="p-3">
          {loadingVersions ? (
            <PageLoader />
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
                  {(v.augmentation_status === "pending" || v.augmentation_status === "processing") && (
                    <p className="mt-1 text-xs font-medium text-brand">
                      Generating… {v.augmentation_progress}%
                    </p>
                  )}
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
            resetVersionWizard()
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
          <Input
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder={versionNamePlaceholder}
          />
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
                    in this dataset. These settings are saved with the version now, and applied for real when you
                    export it — image previews here and elsewhere in the app still show the originals, unchanged.
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
                          <div>
                            <span className="text-sm font-medium text-foreground">{EXTRA_PREPROCESSING_LABELS[id]}</span>
                            {id === "auto_contrast" && (
                              <p className="text-xs text-muted-foreground">
                                {AUTO_CONTRAST_TYPE_LABELS[preprocessing.auto_contrast_type ?? "contrast_stretching"]}
                              </p>
                            )}
                            {id === "random_sample" && preprocessing.random_sample_splits && (
                              <p className="text-xs text-muted-foreground">
                                Train {preprocessing.random_sample_splits.train}% · Valid{" "}
                                {preprocessing.random_sample_splits.valid}% · Test{" "}
                                {preprocessing.random_sample_splits.test}%
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {id === "auto_contrast" && (
                              <button
                                onClick={() => setAutoContrastOpen(true)}
                                className="text-xs font-medium text-brand hover:underline"
                              >
                                Edit
                              </button>
                            )}
                            {id === "random_sample" && (
                              <button
                                onClick={() => setRandomSampleOpen(true)}
                                className="text-xs font-medium text-brand hover:underline"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => setPreprocessing((p) => ({ ...p, [id]: false }))}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <XIcon className="size-3.5" />
                            </button>
                          </div>
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
                          <div className="flex items-center gap-3">
                            {AUGMENTATION_DIALOG_OPENERS[id] && (
                              <button
                                onClick={() => AUGMENTATION_DIALOG_OPENERS[id]?.()}
                                className="text-xs font-medium text-brand hover:underline"
                              >
                                Edit
                              </button>
                            )}
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
                    <Button variant="brand" onClick={handleCreate} disabled={creating}>
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
        onSelect={(id) => {
          // Grayscale is a plain on/off toggle — nothing to configure.
          // Resize, Auto-Contrast, and Random Sample each need real
          // configuration (dimensions/mode; algorithm type; per-split
          // percentages), so picking any of those tiles opens its own
          // dialog — same flow as editing it once it's already added —
          // instead of just flipping a boolean with no values behind it.
          if (id === "resize") {
            setResizeOpen(true)
            return
          }
          if (id === "auto_contrast") {
            setAutoContrastOpen(true)
            return
          }
          if (id === "random_sample") {
            setRandomSampleOpen(true)
            return
          }
          setPreprocessing((p) => ({ ...p, [id]: true }))
        }}
      />
      <AutoContrastDialog
        open={autoContrastOpen}
        onOpenChange={setAutoContrastOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        initialType={preprocessing.auto_contrast_type ?? "contrast_stretching"}
        onApply={(type: AutoContrastType) =>
          setPreprocessing((p) => ({ ...p, auto_contrast: true, auto_contrast_type: type }))
        }
      />
      <RandomSampleDialog
        open={randomSampleOpen}
        onOpenChange={setRandomSampleOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        initialSplits={preprocessing.random_sample_splits ?? { train: 100, valid: 100, test: 100 }}
        onApply={(splits) =>
          setPreprocessing((p) => ({ ...p, random_sample: true, random_sample_splits: splits }))
        }
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
        onSelect={(aug) => {
          // Every type now has its own configuration dialog
          // (checkboxes/sliders) — none are instant-apply anymore.
          const opener = AUGMENTATION_DIALOG_OPENERS[aug.id]
          if (opener) {
            opener()
            return
          }
          setAugmentations((prev) => ({ ...prev, [aug.id]: aug }))
        }}
      />
      <FlipDialog
        open={flipOpen}
        onOpenChange={setFlipOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        initialHorizontal={(augmentations.flip?.params?.horizontal as boolean) ?? true}
        initialVertical={(augmentations.flip?.params?.vertical as boolean) ?? false}
        onApply={({ horizontal, vertical }) =>
          setAugmentations((prev) => ({
            ...prev,
            flip: {
              id: "flip",
              label: horizontal && vertical ? "Flip (Horizontal + Vertical)" : horizontal ? "Flip (Horizontal)" : "Flip (Vertical)",
              style: { transform: `${horizontal ? "scaleX(-1) " : ""}${vertical ? "scaleY(-1)" : ""}`.trim() },
              params: { horizontal, vertical },
            },
          }))
        }
      />
      <SliderAugmentationDialog
        open={hueOpen}
        onOpenChange={setHueOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        title="Hue"
        description="Randomly adjust the colors in the image."
        infoTitle="What is hue augmentation?"
        infoBody="It randomly changes the colors to make your model less sensitive."
        min={0}
        max={180}
        unit="°"
        initialValue={(augmentations.hue?.params?.max_degrees as number) ?? 15}
        symmetric
        previewStyle={(magnitude, sign) => ({ filter: `hue-rotate(${sign * magnitude}deg) saturate(1.3)` })}
        onApply={(value) =>
          setAugmentations((prev) => ({
            ...prev,
            hue: {
              id: "hue",
              label: `Hue (±${value}°)`,
              style: { filter: `hue-rotate(${value}deg) saturate(1.3)` },
              params: { max_degrees: value },
            },
          }))
        }
      />
      <SliderAugmentationDialog
        open={rotationOpen}
        onOpenChange={setRotationOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        title="Rotation"
        description="Add variability to rotations to help your model be more resilient to camera roll."
        infoTitle="Why should I use the Random Rotate augmentation?"
        infoBody="It helps your model detect objects even when the camera or subject are not perfectly aligned."
        min={0}
        max={45}
        unit="°"
        initialValue={(augmentations.rotation?.params?.max_degrees as number) ?? 15}
        symmetric
        previewStyle={(magnitude, sign) => ({ transform: `rotate(${sign * magnitude}deg) scale(1.2)` })}
        onApply={(value) =>
          setAugmentations((prev) => ({
            ...prev,
            rotation: {
              id: "rotation",
              label: `Rotation (±${value}°)`,
              style: { transform: `rotate(${value}deg) scale(1.2)` },
              params: { max_degrees: value },
            },
          }))
        }
      />
      <SliderAugmentationDialog
        open={saturationOpen}
        onOpenChange={setSaturationOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        title="Saturation"
        description="Randomly adjust the vibrancy of the colors in the images."
        infoTitle="What is the saturation augmentation?"
        infoBody="It randomly adjusts your images' colors to make them more or less vibrant."
        min={0}
        max={99}
        unit="%"
        initialValue={(augmentations.saturation?.params?.max_percent as number) ?? 25}
        symmetric
        previewStyle={(magnitude, sign) => ({
          filter: `saturate(${Math.max(0, 1 + (sign * magnitude) / 100)})`,
        })}
        onApply={(value) =>
          setAugmentations((prev) => ({
            ...prev,
            saturation: {
              id: "saturation",
              label: `Saturation (±${value}%)`,
              style: { filter: `saturate(${1 + value / 100})` },
              params: { max_percent: value },
            },
          }))
        }
      />
      <SliderAugmentationDialog
        open={exposureOpen}
        onOpenChange={setExposureOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        title="Exposure"
        description="Add variability to image brightness to help your model be more resilient to lighting and camera setting changes."
        infoTitle="What is the exposure augmentation?"
        infoBody="It randomly brightens or darkens images to simulate different camera exposure settings."
        min={0}
        max={99}
        unit="%"
        initialValue={(augmentations.exposure?.params?.max_percent as number) ?? 10}
        symmetric
        previewStyle={(magnitude, sign) => ({
          filter: `brightness(${Math.max(0, 1 + (sign * magnitude) / 100)}) contrast(1.1)`,
        })}
        onApply={(value) =>
          setAugmentations((prev) => ({
            ...prev,
            exposure: {
              id: "exposure",
              label: `Exposure (±${value}%)`,
              style: { filter: `brightness(${1 + value / 100}) contrast(1.1)` },
              params: { max_percent: value },
            },
          }))
        }
      />
      <SliderAugmentationDialog
        open={blurOpen}
        onOpenChange={setBlurOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        title="Blur"
        description="Add random Gaussian blur to help your model be more resilient to camera focus."
        infoTitle="When should I use Random Blur?"
        infoBody="If your subjects in-the-wild might not be in focus or your model is overfitting on hard edges."
        min={0}
        max={25}
        unit="px"
        initialValue={(augmentations.blur?.params?.max_px as number) ?? 2.5}
        symmetric={false}
        previewStyle={(magnitude) => ({ filter: `blur(${magnitude}px)` })}
        onApply={(value) =>
          setAugmentations((prev) => ({
            ...prev,
            blur: {
              id: "blur",
              label: `Blur (up to ${value}px)`,
              style: { filter: `blur(${Math.min(value, 4)}px)` },
              params: { max_px: value },
            },
          }))
        }
      />
      <BrightnessDialog
        open={brightnessOpen}
        onOpenChange={setBrightnessOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        initialPercent={(augmentations.brightness?.params?.max_percent as number) ?? 15}
        initialBrighten={(augmentations.brightness?.params?.brighten as boolean) ?? true}
        initialDarken={(augmentations.brightness?.params?.darken as boolean) ?? true}
        onApply={({ percent, brighten, darken }) =>
          setAugmentations((prev) => ({
            ...prev,
            brightness: {
              id: "brightness",
              label: `Brightness (±${percent}%)`,
              style: { filter: `brightness(${1 + percent / 100})` },
              params: { max_percent: percent, brighten, darken },
            },
          }))
        }
      />
      <Rotate90Dialog
        open={rotate90Open}
        onOpenChange={setRotate90Open}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        initialClockwise={(augmentations.rotate90?.params?.clockwise as boolean) ?? true}
        initialCounterclockwise={(augmentations.rotate90?.params?.counterclockwise as boolean) ?? true}
        initialUpsideDown={(augmentations.rotate90?.params?.upside_down as boolean) ?? true}
        onApply={({ clockwise, counterclockwise, upsideDown }) => {
          const parts = [
            clockwise && "CW",
            counterclockwise && "CCW",
            upsideDown && "180°",
          ].filter(Boolean)
          setAugmentations((prev) => ({
            ...prev,
            rotate90: {
              id: "rotate90",
              label: `90° Rotate (${parts.join(", ")})`,
              style: { transform: "rotate(90deg) scale(0.7)" },
              params: { clockwise, counterclockwise, upside_down: upsideDown },
            },
          }))
        }}
      />
      <ShearDialog
        open={shearOpen}
        onOpenChange={setShearOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        initialHorizontal={(augmentations.shear?.params?.horizontal_max as number) ?? 10}
        initialVertical={(augmentations.shear?.params?.vertical_max as number) ?? 10}
        onApply={({ horizontal, vertical }) =>
          setAugmentations((prev) => ({
            ...prev,
            shear: {
              id: "shear",
              label: `Shear (±${horizontal}° H, ±${vertical}° V)`,
              style: { transform: `skew(${horizontal}deg, ${vertical}deg) scale(1.1)` },
              params: { horizontal_max: horizontal, vertical_max: vertical },
            },
          }))
        }
      />
      <CropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        initialMinPercent={(augmentations.crop?.params?.min_percent as number) ?? 0}
        initialMaxPercent={(augmentations.crop?.params?.max_percent as number) ?? 20}
        onApply={({ minPercent, maxPercent }) =>
          setAugmentations((prev) => ({
            ...prev,
            crop: {
              id: "crop",
              label: `Crop (${minPercent}%–${maxPercent}%)`,
              style: { transform: `scale(${1 + maxPercent / 100})` },
              params: { min_percent: minPercent, max_percent: maxPercent },
            },
          }))
        }
      />
      <SliderAugmentationDialog
        open={noiseOpen}
        onOpenChange={setNoiseOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        title="Noise"
        description="Add random noise to help your model be more resilient to camera artifacts."
        infoTitle="When should I use Random Noise?"
        infoBody="If your training data was captured in a controlled environment while your deployment environment is less controlled."
        min={0}
        max={10}
        unit="%"
        initialValue={(augmentations.noise?.params?.max_percent as number) ?? 5}
        symmetric={false}
        warningThreshold={5}
        previewStyle={(magnitude) => ({
          filter: `contrast(${1 + magnitude * 0.04}) saturate(${1 - magnitude * 0.04})`,
        })}
        onApply={(value) =>
          setAugmentations((prev) => ({
            ...prev,
            noise: {
              id: "noise",
              label: `Noise (up to ${value}%)`,
              style: { filter: "contrast(1.4) saturate(0.6)" },
              params: { max_percent: value },
            },
          }))
        }
      />
      <GrayscaleAugDialog
        open={grayscaleAugOpen}
        onOpenChange={setGrayscaleAugOpen}
        thumbnailUrl={previewImages[0]?.thumbnail_url ?? null}
        baseStyle={augmentationPreviewBase}
        initialPercent={(augmentations.grayscale?.params?.percent as number) ?? 100}
        onApply={(percent) =>
          setAugmentations((prev) => ({
            ...prev,
            grayscale: {
              id: "grayscale",
              label: `Grayscale (${percent}% of images)`,
              style: { filter: "grayscale(1)" },
              params: { percent },
            },
          }))
        }
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
