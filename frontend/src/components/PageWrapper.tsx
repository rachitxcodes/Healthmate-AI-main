// ✅ src/components/PageWrapper.tsx
import React from "react";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageWrapper({ children, className = "" }: PageWrapperProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
