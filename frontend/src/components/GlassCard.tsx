import React from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * GlassCard - Theme-aware glassmorphic container (Soft-Medical)
 */
const GlassCard: React.FC<GlassCardProps> = ({ children, className = "" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-[2rem] p-8 sm:p-10 bg-white border border-rose-100 shadow-[0_8px_40px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_12px_50px_rgba(244,63,94,0.08)] ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
