import React, { useState } from "react";
import { motion, MotionProps } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

// ✅ Combined types: native input props + framer motion + optional label
type FieldProps = React.InputHTMLAttributes<HTMLInputElement> &
  MotionProps & {
    label?: string; // ✅ made optional
    className?: string;
  };

const MotionInput = motion.input;

export default function Field({ label, className = "", type = "text", ...rest }: FieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div className="w-full flex flex-col items-start relative pb-2">
      {/* Optional label */}
      {label && (
        <label className="mb-2.5 block text-[15px] font-bold text-text-primary tracking-wide">
          {label}
        </label>
      )}

      <div className="relative w-full">
        <MotionInput
          {...rest}
          type={inputType}
          whileFocus={{ scale: 1.01, y: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{ minHeight: '56px' }}
          className={`w-full rounded-[1rem] border-2 border-slate-200 bg-white px-5 py-4
                     text-text-primary placeholder-[#64748B] font-semibold text-[16px] leading-tight 
                     shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10
                     transition-all ${isPassword ? "pr-12" : ""} ${className}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
          >
            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>
        )}
      </div>
    </div>
  );
}
