import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/logo4.png";
import { useAuth } from "../contexts/AuthContext";
import { useState, useRef, useEffect } from "react";

import {
  Dna,
  Pill,
  Stethoscope,
  Bot,
  Settings,
  LogOut,
  LayoutDashboard,
  User
} from "lucide-react";

export default function NavbarPrivate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/dashboard" },
    { icon: <Dna size={18} />, label: "Risk Predictor", path: "/risk-predictor" },
    { icon: <Pill size={18} />, label: "Medicine", path: "/medicine-scheduler" },
    { icon: <Stethoscope size={18} />, label: "Symptoms", path: "/symptom-decoder" },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full z-50 flex justify-center pt-6 pb-4 px-4 bg-gradient-to-b from-[#FFF9FA] via-[#FFF9FA]/90 to-transparent pointer-events-none">
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="pointer-events-auto flex items-center justify-between max-w-7xl w-full bg-white/90 backdrop-blur-md border border-slate-200/50 shadow-floating rounded-full px-4 py-2"
      >
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-3 pl-2">
          <img
            src={logo}
            alt="HealthMate AI"
            className="h-9 w-9 rounded-xl object-cover"
          />
          <span className="text-text-primary text-xl font-bold tracking-tight hidden lg:block">
            HealthMate
          </span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex flex-1 justify-center items-center gap-2">
          {navLinks.map(({ icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`relative px-4 py-2 flex items-center gap-2 rounded-full transition-colors text-sm font-medium z-10 ${isActive ? "text-primary hover:text-primary-hover" : "text-text-secondary hover:text-text-primary"
                  }`}
                style={{ minHeight: '44px' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 bg-primary-light/50 rounded-full -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {icon}
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side icons & dropdown */}
        <div className="flex items-center gap-3 pr-1">
          <Link to="/ai-companion">
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-full flex items-center gap-2 font-semibold text-sm shadow-soft transition-colors"
              style={{ minHeight: '44px' }}
            >
              <Bot size={18} />
              <span className="hidden sm:block">AI Chat</span>
            </motion.button>
          </Link>

          {/* Avatar Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-surface border border-slate-200 text-text-primary h-[44px] w-[44px] rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors focus:outline-none"
            >
              <User size={20} />
            </motion.button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-3 w-56 bg-white border border-slate-100 shadow-floating rounded-2xl flex flex-col p-2 z-50 overflow-hidden"
                >
                  <Link to="/settings" onClick={() => setIsDropdownOpen(false)} className="flex items-center justify-start gap-3 px-4 py-3 rounded-xl hover:bg-surface text-text-primary text-sm font-medium transition-colors">
                    <Settings size={18} className="text-text-secondary" />
                    Profile & Settings
                  </Link>
                  <div className="h-px bg-slate-100 my-1 mx-2" />
                  <button onClick={handleLogout} className="flex items-center justify-start gap-3 px-4 py-3 rounded-xl hover:bg-primary-light/30 text-status-critical text-sm font-medium transition-colors text-left">
                    <LogOut size={18} />
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
