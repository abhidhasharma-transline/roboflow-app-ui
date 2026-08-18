import { useEffect, useState } from "react"
import { BarChart3 } from "lucide-react"
import { SectionHeading } from "@/components/shared/SectionHeading"
import { getMyActivity } from "@/lib/authApi"
import type { ActivityDay } from "@/types/auth"

const WEEKS = 52
const TOTAL_DAYS = WEEKS * 7
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const LEVEL_CLASSES = [
  "bg-muted",
  "bg-purple-200",
  "bg-purple-400",
  "bg-purple-600",
  "bg-purple-800",
]

function levelForCount(count: number): number {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 9) return 3
  return 4
}

// Local calendar date, deliberately NOT toISOString() — that converts to UTC,
// which shifts the date backward for any timezone ahead of UTC (e.g. IST)
// and made "today" mismatch the backend's date grouping.
function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function ActivityStreakCard() {
  const [activity, setActivity] = useState<ActivityDay[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getMyActivity(WEEKS)
      .then(setActivity)
      .finally(() => setIsLoading(false))
  }, [])

  const activityByDate = new Map(activity.map((a) => [a.date, a]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Align the grid so the first column starts on a Sunday (like GitHub)
  const firstDay = new Date(today)
  firstDay.setDate(firstDay.getDate() - (TOTAL_DAYS - 1))
  const alignedStart = new Date(firstDay)
  alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay())

  const totalCells = Math.ceil((today.getTime() - alignedStart.getTime()) / 86400000) + 1
  const totalColumns = Math.ceil(totalCells / 7)

  const days: { date: string; count: number; actions: string[]; col: number; row: number }[] = []
  for (let i = 0; i < totalColumns * 7; i++) {
    const d = new Date(alignedStart)
    d.setDate(d.getDate() + i)
    if (d > today) break
    const key = toDateKey(d)
    const dayActivity = activityByDate.get(key)
    days.push({
      date: key,
      count: dayActivity?.count ?? 0,
      actions: dayActivity?.actions ?? [],
      col: Math.floor(i / 7),
      row: i % 7,
    })
  }

  // Figure out which column each month label should sit above
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  for (const day of days) {
    if (day.row !== 0) continue
    const d = new Date(day.date)
    if (d.getMonth() !== lastMonth) {
      monthLabels.push({ col: day.col, label: MONTH_NAMES[d.getMonth()] })
      lastMonth = d.getMonth()
    }
  }

  const totalActivities = activity.reduce((sum, a) => sum + a.count, 0)

  return (
    <div className="rounded-lg border border-border p-5">
      <SectionHeading icon={BarChart3}>Activity</SectionHeading>
      <p className="-mt-3 mb-4 text-sm text-muted-foreground">
        {totalActivities} activit{totalActivities === 1 ? "y" : "ies"} in the last {WEEKS} weeks
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Month labels */}
          <div
            className="grid mb-1 ml-8"
            style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))` }}
          >
            {monthLabels.map((m) => (
              <span
                key={m.col}
                className="text-xs text-muted-foreground"
                style={{ gridColumnStart: m.col + 1 }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-1.5">
            {/* Day labels */}
            <div className="flex flex-col justify-between w-6 shrink-0 py-0.5">
              {DAY_LABELS.map((label, i) => (
                <span key={i} className="text-xs text-muted-foreground leading-none h-[11px]">
                  {label}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div
              className="grid flex-1"
              title={totalActivities === 0 ? "No activity yet, time to get to work 👀" : undefined}
              style={{
                gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(7, 1fr)`,
                gridAutoFlow: "column",
                columnGap: "3px",
                rowGap: "3px",
              }}
            >
              {days.map((day) => (
                <div
                  key={day.date}
                  title={
                    totalActivities === 0
                      ? undefined
                      : day.count === 0
                        ? `No activity on ${day.date}`
                        : `${day.date}:\n${day.actions.map((a) => `• ${a}`).join("\n")}`
                  }
                  style={{ gridColumnStart: day.col + 1, gridRowStart: day.row + 1 }}
                  className={`aspect-square w-full rounded-sm ${LEVEL_CLASSES[levelForCount(day.count)]}`}
                />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-3 ml-8">
            {/* <span className="text-xs text-muted-foreground">
              Learn how we count activity
            </span> */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Less</span>
              {LEVEL_CLASSES.map((cls, i) => (
                <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
              ))}
              <span className="text-xs text-muted-foreground">More</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
