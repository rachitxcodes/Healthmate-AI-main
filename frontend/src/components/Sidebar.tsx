import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Activity, Pill, Stethoscope, Settings, LogOut, FileText, ChevronRight, HeartPulse } from "lucide-react";
import logo from "../assets/logo4.png";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);

    const navLinks = [
        { icon: <LayoutDashboard size={20} />, path: "/dashboard", label: "Dashboard" },
        { icon: <HeartPulse size={20} />, path: "/vitals", label: "Vitals & Risk" },
        { icon: <Activity size={20} />, path: "/risk-predictor", label: "Predictor" },
        { icon: <Pill size={20} />, path: "/medicine-scheduler", label: "Medicine" },
        { icon: <Stethoscope size={20} />, path: "/symptom-decoder", label: "Symptoms" },
    ];

    return (
        <div className={`fixed left-0 top-0 z-40 h-screen py-4 pl-3 pr-2 transition-all duration-300 ease-in-out ${isExpanded ? "w-64" : "w-[5.5rem] lg:w-24"}`}>
            <div className={`h-full bg-white/80 backdrop-blur-xl rounded-3xl flex flex-col py-7 relative shadow-[0_4px_30px_rgba(59,130,246,0.08)] border border-blue-100/60 ${isExpanded ? "px-4" : "items-center"}`}>

                {/* Logo / Brand */}
                <div className={`flex items-center gap-3 mb-8 w-full relative group ${isExpanded ? "justify-start px-2" : "justify-center flex-col"}`}>
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-1.5 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(59,130,246,0.3)]">
                        <img src={logo} alt="Logo" className="w-8 h-8 rounded-xl" />
                    </div>
                    {isExpanded ? (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-800 font-bold text-[15px] tracking-wide whitespace-nowrap">
                            HealthMate
                        </motion.span>
                    ) : (
                        <span className="text-blue-600 font-bold text-[9px] tracking-widest uppercase mt-1.5">HM</span>
                    )}

                    {/* Expand Toggle */}
                    <button onClick={() => setIsExpanded(!isExpanded)} className={`absolute ${isExpanded ? "-right-8" : "-right-5"} top-2 bg-white hover:bg-blue-50 rounded-full p-1.5 shadow-md border border-blue-100 transition-all z-10`}>
                        <ChevronRight size={14} className={`text-blue-600 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} strokeWidth={3} />
                    </button>
                </div>

                {/* Nav Items */}
                <div className={`flex flex-col gap-2 flex-1 w-full ${isExpanded ? "" : "items-center px-2"}`}>
                    {navLinks.map((link) => {
                        const isActive = location.pathname === link.path || (link.path === "/dashboard" && location.pathname === "/");
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                title={!isExpanded ? link.label : ""}
                                className={`relative flex items-center h-11 transition-all duration-200
                                ${isExpanded ? "w-full rounded-2xl px-3.5 justify-start gap-3.5 hover:bg-blue-50/80" : "w-11 justify-center rounded-xl hover:bg-blue-50/80"}
                                ${isActive && isExpanded ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:shadow-[0_6px_18px_rgba(59,130,246,0.4)] hover:bg-none" : ""}
                                ${isActive && !isExpanded ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.35)]" : ""}
                                ${!isActive ? "text-slate-400 hover:text-blue-600" : ""}`}
                            >
                                <div className="flex-shrink-0">{link.icon}</div>
                                {isExpanded && (
                                    <span className={`font-semibold text-sm whitespace-nowrap transition-colors ${isActive ? "text-white" : "text-slate-600"}`}>
                                        {link.label}
                                    </span>
                                )}
                                {isActive && !isExpanded && (
                                    <motion.div layoutId="sidebar-active" className="absolute left-[-17px] lg:left-[-17px] w-[3px] h-5 bg-blue-500 rounded-r-full" />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Settings / Logout Bottom */}
                <div className={`flex flex-col gap-2 mt-auto w-full ${isExpanded ? "" : "items-center px-2"}`}>
                    <Link to="/settings" title={!isExpanded ? "Settings" : ""} className={`flex items-center h-11 transition-all duration-200 ${isExpanded ? "w-full rounded-2xl px-3.5 justify-start gap-3.5 hover:bg-blue-50/80 text-slate-400 hover:text-blue-600" : "w-11 justify-center rounded-xl hover:bg-blue-50/80 text-slate-400 hover:text-blue-600"}`}>
                        <div className="flex-shrink-0"><Settings size={20} /></div>
                        {isExpanded && <span className="font-semibold text-sm text-slate-600">Settings</span>}
                    </Link>
                    <button onClick={() => { signOut(); navigate("/"); }} title={!isExpanded ? "Logout" : ""} className={`flex items-center h-11 transition-all duration-200 ${isExpanded ? "w-full rounded-2xl px-3.5 justify-start gap-3.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500" : "w-11 justify-center rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500"}`}>
                        <div className="flex-shrink-0"><LogOut size={20} /></div>
                        {isExpanded && <span className="font-semibold text-sm text-rose-500">Logout</span>}
                    </button>
                </div>
            </div>
        </div>
    );
}
