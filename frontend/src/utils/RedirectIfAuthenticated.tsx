import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  children: React.ReactNode;
}

/**
 * RedirectIfAuthenticated
 * -----------------------
 * Used only on public routes:
 * - /
 * - /login
 * - /signup
 *
 * Prevents auto-redirect during Supabase session refresh.
 */
export default function RedirectIfAuthenticated({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 🛑 While auth is loading → DO NOT redirect
  if (loading) return <>{children}</>;

  // 🔐 Only redirect if user is logged in AND you are on a public page:
  const publicRoutes = ["/", "/login", "/signup"];

  if (user && publicRoutes.includes(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
