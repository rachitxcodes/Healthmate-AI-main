import { useState } from "react";
import { motion } from "framer-motion";
import Page from "../components/Page";
import GlassCard from "../components/GlassCard";
import Field from "../components/Field";
import PrimaryButton from "../components/PrimaryButton";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo4.png";

export default function Signup() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsSuccess(false);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Signup failed. Please try again.");
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: fullName,
          email: email,
        });

      if (profileError) {
        console.error("Profile insert error:", profileError);
        setMessage("Account created, but profile setup failed.");
        return;
      }

      setIsSuccess(true);
      setMessage("Account created successfully! Redirecting...");
      setTimeout(() => navigate("/login"), 1200);

    } catch (err) {
      console.error("Signup Error:", err);
      setMessage("Error creating account.");
    } finally {
      setLoading(false);
      setFullName("");
      setEmail("");
      setPassword("");
    }
  }

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
              Create Account
            </motion.h1>
            <p className="text-slate-500 mt-2.5 text-[15px] font-medium text-center">Join HealthMate to start analyzing.</p>
          </div>

          <motion.form
            onSubmit={handleSignup}
            className="space-y-6"
          >
            <Field
              label="Full Name"
              required
              value={fullName}
              onChange={(e: any) => setFullName(e.target.value)}
            />
            <Field
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
            />
            <Field
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
            />

            {message && (
              <p className={`text-center text-[14px] font-bold p-3 rounded-xl ${isSuccess ? 'bg-emerald-50 text-status-success' : 'bg-rose-50 text-status-critical'}`}>
                {message}
              </p>
            )}

            <div className="pt-4">
              <PrimaryButton type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Account"}
              </PrimaryButton>
            </div>
          </motion.form>

          <div className="mt-8 text-center text-[15px] font-medium text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-bold hover:text-primary-hover transition-colors ml-1">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </Page>
  );
}
