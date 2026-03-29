import React from "react";
import { motion, MotionProps } from "framer-motion";

// ✅ Merge native <button> attributes + Motion props
type PrimaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  MotionProps & {
    children: React.ReactNode;
    className?: string;
  };

const MotionButton = motion.button;

/**
 * PrimaryButton — Animated, fully typed button
 */
const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  className = "",
  disabled = false,
  type = "button",
  onClick,
  ...rest
}) => {
  return (
    <MotionButton
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      transition={{ duration: 0.15 }}
      style={{ minHeight: '56px' }}
      className={`rounded-[1.25rem] px-6 py-4 font-bold text-[17px] transition-all shadow-[0_4px_20px_rgba(244,63,94,0.15)] w-full flex justify-center items-center gap-2
        ${disabled
          ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200"
          : "bg-primary text-white hover:bg-primary-hover hover:shadow-[0_8px_30px_rgba(244,63,94,0.25)] hover:-translate-y-0.5"
        } ${className}`}
      {...rest}
    >
      {children}
    </MotionButton>
  );
};

export default PrimaryButton;
