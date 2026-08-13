import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 116"
      className={cn("size-6", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-mark-gradient" x1="34" y1="6" x2="92" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* speech bubble */}
      <rect
        x="34"
        y="6"
        width="58"
        height="40"
        rx="12"
        stroke="url(#logo-mark-gradient)"
        strokeWidth="6"
      />
      <path d="M42 44 L36 60 L52 44 Z" fill="url(#logo-mark-gradient)" />

      {/* pencil tip */}
      <path
        d="M55 16v10l8 7 8-7V16"
        stroke="url(#logo-mark-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* text lines */}
      <rect x="6" y="70" width="34" height="8" rx="4" fill="#1d5fd6" />
      <rect x="6" y="86" width="76" height="8" rx="4" fill="#1d5fd6" />
      <rect x="6" y="102" width="60" height="8" rx="4" fill="#1d5fd6" />
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