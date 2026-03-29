import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo4.png";
import { motion } from "framer-motion";

function AuthToggle() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const authLink = isLoginPage ? "/signup" : "/login";
  const authText = isLoginPage ? "Register" : "Login";

  return (
    <Link to={authLink}>
      <motion.button
        whileTap={{ scale: 0.96 }}
        className="bg-slate-900 text-white hover:bg-black border border-transparent px-7 py-3 rounded-[1.25rem] font-bold shadow-[0_4px_15px_rgba(0,0,0,0.1)] transition-all text-[15px]"
        style={{ minHeight: '48px' }}
      >
        {authText}
      </motion.button>
    </Link>
  );
}

export default function Navbar() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-50 flex justify-center pt-6 pb-4 px-4 bg-gradient-to-b from-[#FFF1F2] via-[#FFF1F2]/95 to-transparent pointer-events-none">
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="pointer-events-auto flex items-center justify-between max-w-7xl w-full bg-white/80 backdrop-blur-xl border border-rose-100 shadow-[0_8px_30px_rgba(244,63,94,0.06)] rounded-[2rem] px-6 py-3"
      >
        <Link to="/" className="flex items-center gap-3 group">
          <img src={logo} alt="HealthMate AI" className="h-9 w-9 rounded-xl object-cover group-hover:scale-105 transition-transform shadow-sm" />
          <span className="font-bold text-xl text-slate-900 tracking-tight">HealthMate</span>
        </Link>

        <div className="flex space-x-6 items-center">
          {session ? (
            <>
              <Link to="/dashboard" className="text-slate-500 hover:text-slate-900 font-bold transition-colors">Dashboard</Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/");
                }}
                className="text-slate-400 hover:text-rose-500 font-bold transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <AuthToggle />
          )}
        </div>
      </motion.nav>
    </div>
  );
}
