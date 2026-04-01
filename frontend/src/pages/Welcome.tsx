import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import FeatureTiles from "../components/FeatureTile";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-slate-900 overflow-x-hidden relative z-0">
      {/* Soft Light Pink Ambient Background */}
      <div className="fixed inset-0 bg-[#FFF1F2] -z-20 transform-gpu" />
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-white blur-[100px] opacity-80 -z-10 pointer-events-none transform-gpu" />
      <div className="fixed top-[10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-rose-100 blur-[120px] opacity-60 -z-10 pointer-events-none transform-gpu" />
      <div className="fixed bottom-[-10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-white blur-[120px] opacity-90 -z-10 pointer-events-none transform-gpu" />

      <Navbar />

      <main className="relative mx-auto max-w-7xl px-6 pt-40 pb-20 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 flex items-center">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-[44px] leading-tight sm:text-[56px] font-bold tracking-tight text-slate-900"
            >
              Your Health, <span className="text-rose-500">Decoded</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-4 text-sm font-bold tracking-widest text-rose-500 uppercase"
            >
              Decode. Predict. Prevent.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 max-w-xl text-slate-600 text-[16px] sm:text-[18px] leading-relaxed font-semibold pr-4 drop-shadow-sm"
            >
              A warm, intelligent companion that helps you understand your lab reports. Upload your reports, decode symptoms, predict risks early, and build a healthier lifestyle with confidence.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate("/login")}
                className="px-8 py-3.5 rounded-[1.25rem] font-bold text-white bg-slate-900 hover:bg-black shadow-[0_8px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 transition-all outline-none flex items-center justify-center text-[16px] border border-slate-800"
                style={{ minHeight: '56px' }}
              >
                Get Started
              </motion.button>

              <Link to="/signup" className="flex">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="px-8 py-3.5 rounded-[1.25rem] font-bold text-slate-900 bg-white border-2 border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all text-[16px] flex items-center justify-center flex-1"
                  style={{ minHeight: '56px' }}
                >
                  Create an account
                </motion.button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative overflow-hidden rounded-[2.5rem] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-200/80 p-2"
          >
            <div className="rounded-[2rem] overflow-hidden relative">
              <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-slate-900/10 pointer-events-none" />
            </div>
          </motion.div>
        </div>
      </main>

      <section className="mt-8 mb-24 px-6 max-w-7xl mx-auto">
        <FeatureTiles />
      </section>
    </div>
  );
}
