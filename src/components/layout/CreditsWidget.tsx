import { Zap } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

export function CreditsWidget() {
  const used = 4
  const total = 15
  const pct = (used / total) * 100

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <Zap className="size-3.5 fill-amber-500 text-amber-500" />
        {used} / {total} Credits
      </div>
      <Progress value={pct} className="h-1.5 [&>div]:bg-amber-500" />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Resets on August 1
      </p>
      <Button
        size="sm"
        className="mt-2 w-full bg-amber-500 text-white hover:bg-amber-500/90"
      >
        Upgrade
      </Button>
    </div>
  )
}