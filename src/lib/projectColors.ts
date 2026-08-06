// Deterministic, distinct color per project id — same project always gets the
// same color anywhere it's tagged, no state/config needed.
const PALETTE = [
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-pink-100", text: "text-pink-700" },
  { bg: "bg-green-100", text: "text-green-700" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-red-100", text: "text-red-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getProjectColor(projectId: string): { bg: string; text: string } {
  return PALETTE[hashString(projectId) % PALETTE.length]
}
