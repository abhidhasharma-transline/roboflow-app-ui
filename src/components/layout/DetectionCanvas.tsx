import { useEffect, useRef, useCallback } from "react"

interface Box {
  id: number
  x: number
  y: number
  w: number
  h: number
  label: string
  conf: number
  color: string
  progress: number
  lifetime: number
  age: number
}

const LABELS = [
  { name: "person", color: "#7c3aed" },
  { name: "car", color: "#06b6d4" },
  { name: "dog", color: "#ec4899" },
  { name: "bicycle", color: "#22c55e" },
  { name: "laptop", color: "#f59e0b" },
  { name: "backpack", color: "#8b5cf6" },
  { name: "chair", color: "#14b8a6" },
]

export default function DetectionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxesRef = useRef<Box[]>([])
  const frameRef = useRef<number>(0)
  const counterRef = useRef(0)
  const spawnTimerRef = useRef(0)

  const spawnBox = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    const margin = 40
    const maxW = w * 0.45
    const maxH = h * 0.45
    const bw = Math.random() * (maxW - 60) + 60
    const bh = Math.random() * (maxH - 60) + 60
    const x = Math.random() * (w - bw - margin * 2) + margin
    const y = Math.random() * (h - bh - margin * 2) + margin
    const lbl = LABELS[Math.floor(Math.random() * LABELS.length)]

    boxesRef.current.push({
      id: counterRef.current++,
      x,
      y,
      w: bw,
      h: bh,
      label: lbl.name,
      color: lbl.color,
      conf: Math.round(Math.random() * 20 + 79),
      progress: 0,
      lifetime: Math.random() * 120 + 80,
      age: 0,
    })

    if (boxesRef.current.length > 7) {
      boxesRef.current.shift()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")!

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener("resize", resize)

    const drawBackground = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight

      const grad = ctx.createRadialGradient(w * 0.4, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.8)
      grad.addColorStop(0, "#1a1b2e")
      grad.addColorStop(1, "#0b0c10")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = "rgba(255,255,255,0.03)"
      ctx.lineWidth = 1
      const cellSize = 40
      for (let gx = 0; gx < w; gx += cellSize) {
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.lineTo(gx, h)
        ctx.stroke()
      }
      for (let gy = 0; gy < h; gy += cellSize) {
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(w, gy)
        ctx.stroke()
      }

      const scanY = ((Date.now() / 8) % (h + 40)) - 20
      const scanGrad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20)
      scanGrad.addColorStop(0, "rgba(91,94,244,0)")
      scanGrad.addColorStop(0.5, "rgba(91,94,244,0.15)")
      scanGrad.addColorStop(1, "rgba(91,94,244,0)")
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, scanY - 20, w, 40)
    }

    const drawBox = (box: Box) => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      void w
      void h
      const alpha = Math.min(1, box.progress * 3) * Math.min(1, (box.lifetime - box.age) / 20)

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = box.color + "18"
      ctx.fillRect(box.x, box.y, box.w, box.h)

      const perim = 2 * (box.w + box.h)
      const drawn = perim * Math.min(1, box.progress * 2)
      ctx.strokeStyle = box.color
      ctx.lineWidth = 1.5
      ctx.setLineDash([])
      ctx.beginPath()
      let rem = drawn
      const top = Math.min(rem, box.w)
      ctx.moveTo(box.x, box.y)
      ctx.lineTo(box.x + top, box.y)
      rem -= top
      if (rem > 0) {
        const right = Math.min(rem, box.h)
        ctx.lineTo(box.x + box.w, box.y + right)
        rem -= right
      }
      if (rem > 0) {
        const bottom = Math.min(rem, box.w)
        ctx.lineTo(box.x + box.w - bottom, box.y + box.h)
        rem -= bottom
      }
      if (rem > 0) {
        ctx.lineTo(box.x, box.y + box.h - rem)
      }
      ctx.stroke()

      const cs = 8
      ctx.lineWidth = 2
      ;[[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].forEach(([cx, cy], index) => {
        ctx.beginPath()
        const dx = index % 2 === 0 ? 1 : -1
        const dy = index < 2 ? 1 : -1
        ctx.moveTo(cx + dx * cs, cy)
        ctx.lineTo(cx, cy)
        ctx.lineTo(cx, cy + dy * cs)
        ctx.strokeStyle = box.color
        ctx.stroke()
      })

      if (box.progress > 0.5) {
        const badgeAlpha = Math.min(1, (box.progress - 0.5) * 4)
        ctx.globalAlpha = alpha * badgeAlpha
        const text = `${box.label}  ${box.conf}%`
        ctx.font = "500 11px monospace"
        const textW = ctx.measureText(text).width + 12
        const bx = box.x
        const by = box.y - 22
        ctx.fillStyle = box.color
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath()
          ctx.roundRect(bx, by, textW, 18, 3)
          ctx.fill()
        } else {
          ctx.fillRect(bx, by, textW, 18)
        }
        ctx.fillStyle = "#0b0c10"
        ctx.fillText(text, bx + 6, by + 13)
      }
      ctx.restore()
    }

    const drawHUD = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight

      ctx.save()
      ctx.font = "400 10px monospace"
      ctx.fillStyle = "rgba(0,217,163,0.7)"
      ctx.fillText("● LIVE", 16, 20)

      ctx.fillStyle = "rgba(255,255,255,0.25)"
      ctx.fillText(`OBJECTS: ${boxesRef.current.length}`, 16, 36)
      ctx.fillText(`FRAME: ${String(counterRef.current).padStart(4, "0")}`, 16, 52)

      ctx.font = "400 9px monospace"
      const modelTag = "YOLOv8n • 12ms • 512×512"
      ctx.fillStyle = "rgba(255,255,255,0.18)"
      ctx.fillText(modelTag, w - ctx.measureText(modelTag).width - 16, h - 16)
      ctx.restore()
    }

    const animate = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      drawBackground()
      spawnTimerRef.current++
      if (spawnTimerRef.current % 50 === 0) {
        spawnBox()
      }

      boxesRef.current = boxesRef.current.filter((b) => b.age < b.lifetime)
      for (const box of boxesRef.current) {
        box.age++
        box.progress = Math.min(1, box.progress + 0.04)
        drawBox(box)
      }

      drawHUD()
      counterRef.current += 1
      frameRef.current = requestAnimationFrame(animate)
    }

    for (let i = 0; i < 4; i++) {
      setTimeout(spawnBox, i * 300)
    }
    frameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(frameRef.current)
    }
  }, [spawnBox])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#09090F]">

      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />

      {/* top gradient */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/40 to-transparent" />

      {/* bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#09090F] via-[#09090F]/70 to-transparent" />

      {/* Branding */}
      <div className="absolute inset-0 flex flex-col justify-between p-12">

        <div>

          <p className="text-xs uppercase tracking-[0.35em] text-violet-400">
            REAL-TIME DETECTION
          </p>

        </div>

        <div className="max-w-md">

          <h1 className="text-5xl font-bold leading-tight text-white">
            Build.
            <br />
            Annotate.
            <br />
            Deploy.
          </h1>

          <p className="mt-5 text-zinc-400 text-base leading-7">
            Create datasets, annotate images and train computer vision
            models with a fast collaborative workflow.
          </p>

          <div className="mt-10 space-y-4">

            {/* <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              <span className="text-sm text-zinc-300">
                AI Assisted Annotation
              </span>
            </div> */}

            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span className="text-sm text-zinc-300">
                Dataset Versioning
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-zinc-300">
                YOLO • COCO • Pascal VOC
              </span>
            </div>

          </div>

        </div>

      </div>

    </div>
  )
}