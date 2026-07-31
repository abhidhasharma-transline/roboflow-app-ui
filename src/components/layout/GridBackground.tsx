export default function GridBackground() {
  return (
    <>
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)
          `,
          backgroundSize: "36px 36px",
        }}
      />

      <div className="absolute top-20 h-px w-full bg-violet-500/40 blur-sm" />

      <div className="absolute bottom-20 h-px w-full bg-violet-500/30 blur-sm" />
    </>
  )
}