import { motion } from "framer-motion"

const COLORS = {
  person: "border-violet-400 text-violet-300 bg-violet-400/10",
  car: "border-cyan-400 text-cyan-300 bg-cyan-400/10",
  bicycle: "border-amber-400 text-amber-300 bg-amber-400/10",
  dog: "border-pink-400 text-pink-300 bg-pink-400/10",
  laptop: "border-lime-400 text-lime-300 bg-lime-400/10",
  backpack: "border-orange-400 text-orange-300 bg-orange-400/10",
}

type Props = {
  x: number
  y: number
  w: number
  h: number
  label: keyof typeof COLORS
  delay: number
}

export default function FloatingBox({
  x,
  y,
  w,
  h,
  label,
  delay,
}: Props) {
  return (
    <motion.div
      className={`absolute border-2 rounded-sm ${COLORS[label]}`}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
      }}
      animate={{
        x: [0, 18, -10, 0],
        y: [0, -14, 10, 0],
        rotate: [0, 0.4, -0.4, 0],
        opacity: [0.7, 1, 0.9, 0.7],
      }}
      transition={{
        duration: 8 + Math.random() * 4,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <div
        className={`absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-medium ${COLORS[label]}`}
      >
        {label}
      </div>
    </motion.div>
  )
}