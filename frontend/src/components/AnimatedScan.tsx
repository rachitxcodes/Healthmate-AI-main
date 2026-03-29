import { motion } from "framer-motion";

export default function AnimatedScan() {
  return (
    <div className="relative aspect-[4/5] w-full max-w-sm rounded-2xl border border-white/60 bg-white/70 p-4 shadow backdrop-blur-xl">
      {/* faux report lines */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`h-3 rounded ${i % 3 === 0 ? "w-3/5 bg-slate-300/80" : "w-full bg-slate-200/80"}`}
          />
        ))}
      </div>

      {/* scanning overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
        initial={false}
      >
        <motion.div
          className="absolute left-0 right-0 h-16 bg-gradient-to-b from-indigo-400/25 via-indigo-300/15 to-transparent"
          animate={{ top: ["0%", "85%", "0%"] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* target markers */}
        {[25, 55, 72].map((y, idx) => (
          <motion.div
            key={idx}
            className="absolute left-3 right-3 h-8 rounded border border-indigo-400/50"
            style={{ top: `${y}%` }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2 + idx * 0.4, repeat: Infinity }}
          />
        ))}
      </motion.div>
    </div>
  );
}
