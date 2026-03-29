// src/components/Page.tsx
import { motion } from "framer-motion";
import React from "react";

export default function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
      className="min-h-screen w-full"
    >
      {children}
    </motion.main>
  );
}
