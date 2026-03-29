import { motion } from "framer-motion";

export default function BackgroundAura() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#f3f6ff] via-[#eef1ff] to-[#e9e9ff]" />
      <motion.div
        className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl"
        animate={{ x: [0, 24, 0], y: [0, 12, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-28 -right-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl"
        animate={{ x: [0, -28, 0], y: [0, -16, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
