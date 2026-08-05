import type { LucideIcon } from "lucide-react"

export function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex size-6 items-center justify-center rounded-md bg-brand/15 text-brand">
        <Icon className="size-3.5" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{children}</h2>
    </div>
  )
}
