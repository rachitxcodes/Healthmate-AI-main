import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Page from "../components/Page";
import BackgroundAura from "../components/BackgroundAura";
import GlassCard from "../components/GlassCard";
import Field from "../components/Field";
import PrimaryButton from "../components/PrimaryButton";

const steps = ["Profile", "Health Focus", "Consent"] as const;

export default function Registration() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  return (
    <Page>
      <div className="relative flex min-h-screen items-center justify-center">
        <BackgroundAura />

        <GlassCard>
          {/* Step header */}
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center text-[24px] font-semibold text-slate-800"
          >
            Registration
          </motion.h2>

          {/* Step indicator */}
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-500">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    i <= stepIndex ? "bg-indigo-500" : "bg-slate-300"
                  }`}
                />
                <span className={`${i === stepIndex ? "text-slate-700" : ""}`}>{s}</span>
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="mt-8 min-h-[220px]">
            <AnimatePresence mode="wait">
              {step === "Profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <Field label="Age" type="number" placeholder="22" />
                  <Field label="Gender" placeholder="Female / Male / Other" />
                  <Field label="Location" placeholder="City, Country" />
                </motion.div>
              )}

              {step === "Health Focus" && (
                <motion.div
                  key="focus"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <Field label="Primary Concern" placeholder="e.g., Thyroid / PCOS / Diabetes" />
                  <Field label="Goals" placeholder="e.g., Energy, Sleep, Weight, Labs" />
                  <Field label="Allergies (optional)" placeholder="e.g., Penicillin" />
                </motion.div>
              )}

              {step === "Consent" && (
                <motion.div
                  key="consent"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-slate-600">
                    By continuing, you agree to securely share your health data with HealthMate AI
                    to generate insights. You can revoke consent anytime in Settings.
                  </p>
                  <label className="flex items-center gap-3 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4" /> I agree to the Privacy Policy.
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={back}
              disabled={stepIndex === 0}
              className="w-1/3 rounded-xl border border-slate-300 bg-white/70 py-3 text-slate-700
                         disabled:opacity-50"
            >
              Back
            </button>
            {stepIndex < steps.length - 1 ? (
              <PrimaryButton onClick={next}>Next</PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => alert("Registered! (Wire to backend later)")}>
                Finish
              </PrimaryButton>
            )}
          </div>
        </GlassCard>
      </div>
    </Page>
  );
}
