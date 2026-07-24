import {
  Share2,
  Sparkles,
  Settings,
  SlidersHorizontal,
  Wand2,
  Lock,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"

export function TrainPage() {
  const [engine, setEngine] = useState<"custom" | "nas" | null>(null)

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-8 pb-28">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-foreground">
            <Share2 className="size-6" />
            Train a Model
          </h1>
          <Button variant="brand" disabled={!engine}>
            <Share2 className="size-4" />
            Start Training
          </Button>
        </div>

        <div className="mb-7 flex items-center justify-between gap-4 rounded-lg border border-brand/25 bg-brand/5 p-4">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Sparkles className="size-4 text-brand" />
            Neural Architecture Search can automatically find the best model
            for your data. Upgrade your plan to get started.
          </p>
          <Button variant="brand" size="sm" className="shrink-0">
            Upgrade for NAS
          </Button>
        </div>

        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground">
          <Settings className="size-4 text-brand" />
          Select Engine
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Select how you want to train your model. You can either configure
          the training yourself or let Annomaster find the optimal model
          automatically.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            onClick={() => setEngine("custom")}
            className={cn(
              "rounded-lg border p-5 text-left transition-colors",
              engine === "custom"
                ? "border-brand ring-1 ring-brand"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-muted">
              <SlidersHorizontal className="size-4.5 text-foreground" />
            </div>
            <h3 className="mb-1 font-semibold text-foreground">
              Custom Training
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Choose your model architecture and configure training
              parameters.
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>· Select from existing model architectures</li>
              <li>· Configure model size and checkpoints</li>
            </ul>
          </button>

          <div className="relative rounded-lg border border-border p-5 opacity-60">
            <span className="absolute top-4 right-4 flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
              <Lock className="size-3" />
              Upgrade
            </span>
            <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-muted">
              <Wand2 className="size-4.5 text-foreground" />
            </div>
            <h3 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
              Neural Architecture Search
              <button className="text-xs font-normal text-brand hover:underline">
                How It Works
              </button>
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Let Annomaster automatically design the best models for your
              data.
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>· Automated model design</li>
              <li>· Optimized for your specific dataset</li>
              <li>· Select speed and accuracy tradeoff after training</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sticky step bar */}
      <div className="flex items-center justify-between border-t border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium",
              engine
                ? "border-brand bg-brand/10 text-brand"
                : "border-border text-foreground"
            )}
          >
            <Settings className="size-3.5" />
            Select Engine
          </span>
          <span className="h-px w-8 bg-border" />
          <span className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground/50">
            <Layers className="size-3.5" />
            Select Version
          </span>
        </div>
        <Button variant="brand" disabled={!engine}>
          <Share2 className="size-4" />
          Start Training
        </Button>
      </div>
    </div>
  )
}