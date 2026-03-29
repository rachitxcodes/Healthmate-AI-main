import { useState } from "react";
import { motion } from "framer-motion";
import Page from "../components/Page";
import GlassCard from "../components/GlassCard";
import Field from "../components/Field";
import PrimaryButton from "../components/PrimaryButton";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo4.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else if (data.session) {
      navigate("/dashboard");
    }

    setLoading(false);
  };

  return (
    <Page>
      <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-8 bg-surface">
        <div className="w-full max-w-[440px] mx-auto bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-rose-100/50 relative z-10 mt-12 mb-12">
          <div className="flex flex-col items-center mb-10">
            <div className="p-3 bg-slate-50 flex items-center justify-center rounded-2xl mb-6 shadow-sm border border-slate-100">
              <img src={logo} alt="HealthMate AI Logo" className="w-12 h-12 rounded-xl object-cover" />
            </div>
            <motion.h1
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center font-black text-[28px] text-slate-900 tracking-tight leading-tight"
            >
              Welcome Back
            </motion.h1>
            <p className="text-slate-500 mt-2.5 text-[15px] font-medium text-center">Please enter your details to sign in.</p>
          </div>

          <motion.form onSubmit={handleLogin} className="space-y-6">
            <Field label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
            <Field label="Password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />

            {error && <p className="text-status-critical text-[14px] font-bold text-center bg-rose-50 p-3 rounded-xl">{error}</p>}

            <div className="pt-4">
              <PrimaryButton type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </PrimaryButton>
            </div>
          </motion.form>

          <div className="mt-8 text-center text-[15px] font-medium text-slate-500">
            Don't have an account? <Link to="/signup" className="text-primary font-bold hover:text-primary-hover transition-colors ml-1">Create one</Link>
          </div>
        </div>
      </div>
    </Page>
  );
}