import { motion } from "framer-motion";
import { ShieldCheck, Pill, Stethoscope, BrainCircuit, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const tiles = [
  {
    icon: ShieldCheck,
    title: "Health Risk Predictor",
    desc: "Upload blood tests, scans, or lab reports and let AI decode values, highlight anomalies, and estimate early-stage risk—well before symptoms appear.",
    to: "/risk-predictor",
  },
  {
    icon: Pill,
    title: "Smart Medication Planner",
    desc: "Organize prescriptions, dosages, and reminders automatically. Track adherence like a streak so you never miss a dose.",
    to: "/medicine-scheduler",
  },
  {
    icon: Stethoscope,
    title: "AI Symptom Decoder",
    desc: "Describe symptoms in simple words and get medically aligned insights, likely causes, and next-step recommendations.",
    to: "/symptom-decoder",
  },
  {
    icon: BrainCircuit,
    title: "AI Health Companion",
    desc: "A continuous, always-learning wellness assistant that studies patterns, predicts trends, and guides you 24×7.",
    to: "/ai-companion",
  },
];

export default function FeatureTiles() {
  return (
    <section className="relative mx-auto max-w-7xl px-0 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-8"
      >
        {tiles.map(({ icon: Icon, title, desc, to }, i) => (
          <motion.article
            key={title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, delay: i * 0.06 }}
            className="group relative rounded-[2.5rem] border border-rose-100 bg-white p-8 sm:p-10
                       shadow-[0_8px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_60px_rgba(244,63,94,0.15)]
                       hover:border-rose-400 transition-all duration-300 hover:-translate-y-2 flex flex-col overflow-hidden"
          >
            {/* Highlight Glow Effect on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="flex items-start gap-4 relative z-10">
              <div className="rounded-[1.25rem] bg-rose-50 border border-rose-100 p-3.5 shadow-sm text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors duration-300">
                <Icon className="h-7 w-7" strokeWidth={2.25} />
              </div>
              <h3 className="text-[1.35rem] sm:text-2xl font-black tracking-tight text-slate-900 mt-1">{title}</h3>
            </div>

            <p className="mt-5 text-[15px] sm:text-[15.5px] font-semibold leading-relaxed text-slate-600 flex-1 relative z-10">
              {desc}
            </p>

            {/* Explore → link at bottom */}
            <div className="mt-8 relative z-10">
              <Link
                to={to}
                className="inline-flex items-center gap-2 text-rose-500 font-bold hover:text-rose-600 transition-colors"
              >
                Explore
                <span className="transform group-hover:translate-x-1 transition-transform bg-rose-100 group-hover:bg-rose-200 text-rose-700 rounded-full p-1 shadow-sm"><ArrowRight size={14} strokeWidth={3} /></span>
              </Link>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
