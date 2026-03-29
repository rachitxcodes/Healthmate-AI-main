import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * ProtectedRoute ensures that only authenticated users
 * can access private pages like Dashboard, UploadReport, etc.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();

  // If user is not logged in → redirect to Welcome page
  if (!session || !user) {
    return <Navigate to="/" replace />;
  }

  // If logged in → show the page content
  return <>{children}</>;
}
