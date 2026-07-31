import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-6", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <circle cx="12.5" cy="13" r="4" fill="white" fillOpacity="0.95" />
      <path
        d="M20 10.5 L25 20.5 H15 Z"
        fill="white"
        fillOpacity="0.7"
      />
    </svg>
  )
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string
  showWordmark?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Annomaster
        </span>
      )}
    </div>
  )
}