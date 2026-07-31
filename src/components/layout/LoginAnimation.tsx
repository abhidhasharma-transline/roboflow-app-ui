import FloatingBox from "./FloatingBox"
import GridBackground from "./GridBackground"

const labels = [
  "person",
  "car",
  "bicycle",
  "dog",
  "laptop",
  "backpack",
] as const

const boxes = Array.from({ length: 22 }).map((_, i) => ({
  x: Math.random() * 700,
  y: Math.random() * 500,
  w: 70 + Math.random() * 110,
  h: 55 + Math.random() * 80,
  label: labels[Math.floor(Math.random() * labels.length)],
  delay: i * 0.25,
}))

export default function LoginAnimation() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#09090F]">

      <GridBackground />

      {boxes.map((b, i) => (
        <FloatingBox key={i} {...b} />
      ))}

      <div className="absolute bottom-16 left-14 max-w-md">

        <p className="text-xs tracking-[0.3em] uppercase text-violet-400">
          REAL-TIME INFERENCE
        </p>

        <h1 className="mt-5 text-5xl font-bold text-white leading-tight">
          Label faster.
          <br />
          Train smarter.
          <br />
          Ship models.
        </h1>

        <div className="mt-10 space-y-4 text-sm text-zinc-400">

          {/* <div>⚡ AI-assisted annotations</div> */}

          {/* <div>📦 Dataset versioning</div>

          <div>🚀 Private model deployment</div> */}

        </div>
      </div>
    </div>
  )
}