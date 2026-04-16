import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Droplets,
  Thermometer,
  AlertTriangle,
  Clock,
  History,
  Activity,
  ShieldAlert,
  ChevronRight,
  Info
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import GlassCard from "../components/GlassCard";
import { supabase } from "../supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// --- Types ---
interface VitalsData {
  heart_rate: number;
  spo2: number;
  temperature: number;
  steps?: number;
  activity?: string;
  recorded_at: string;
  age_seconds: number;
  is_stale: boolean;
}

interface RiskScore {
  score: number;
  status: "Stable" | "Warning" | "Critical";
  breakdown: {
    hr_points: number;
    spo2_points: number;
    temp_points: number;
    report_points: number;
    symptom_points: number;
  };
  report_available: boolean;
}

export default function Vitals() {
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [risk, setRisk] = useState<RiskScore | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const sosTimerRef = useRef<any>(null);

  // --- Data Fetching ---
  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      // 1. Fetch History (do this first to sync cards)
      const historyResp = await fetch(`${API_BASE_URL}/api3/vitals/history?hours=24`, { headers });
      let currentHistory: any[] = [];
      if (historyResp.ok) {
        const historyData = await historyResp.json();
        currentHistory = historyData.readings || [];
        setHistory(currentHistory);
      }

      // 2. Fetch Latest Vitals (as fallback/backup)
      const vitalsResp = await fetch(`${API_BASE_URL}/api3/vitals/latest`, { headers });
      if (vitalsResp.ok) {
        const vitalsData = await vitalsResp.json();
        
        // SYNC LOGIC: If we have history points, use the VERY LATEST point for the cards
        if (currentHistory.length > 0) {
          const latestPoint = currentHistory[currentHistory.length - 1];
          setVitals({
            ...vitalsData,
            heart_rate: latestPoint.heart_rate,
            spo2: latestPoint.spo2,
            temperature: latestPoint.temperature,
            recorded_at: latestPoint.recorded_at
          });
        } else {
          setVitals(vitalsData);
        }
      }

      // 3. Fetch Risk Score
      const riskResp = await fetch(`${API_BASE_URL}/api3/risk-score`, { headers });
      if (riskResp.ok) {
        const riskData = await riskResp.json();
        setRisk(riskData);
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Vitals fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, []);

  // --- SOS Logic ---
  const startSosTimer = () => {
    setSosProgress(0);
    const step = 2; 
    sosTimerRef.current = setInterval(() => {
      setSosProgress(prev => {
        if (prev >= 100) {
          triggerSos();
          clearInterval(sosTimerRef.current);
          return 100;
        }
        return prev + step;
      });
    }, 50); 
  };

  const cancelSosTimer = () => {
    clearInterval(sosTimerRef.current);
    setSosProgress(0);
  };

  const triggerSos = async () => {
    setSosLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${API_BASE_URL}/api3/sos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      alert("🆘 SOS Triggered! Emergency contacts have been notified.");
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSosLoading(false);
      setSosProgress(0);
    }
  };

  // --- Helpers ---
  const getStatusColor = (status: string | undefined) => {
    if (status === "Critical") return "text-rose-500 bg-rose-50 border-rose-100";
    if (status === "Warning") return "text-amber-500 bg-amber-50 border-amber-100";
    return "text-emerald-500 bg-emerald-50 border-emerald-100";
  };

  const getRiskColor = (score: number) => {
    if (score >= 71) return "#f43f5e";
    if (score >= 41) return "#f59e0b";
    return "#10b981";
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  if (isLoading && !vitals) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full" />
        <p className="text-slate-400 font-bold animate-pulse">Initializing Health Monitor...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vitals Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm ${getStatusColor(risk?.status)}`}>
              {risk?.status || "Analyzing"}
            </span>
            <div className="flex items-center gap-1.5 text-blue-500 text-[10px] font-bold bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg shadow-sm">
              <Clock size={12} className="animate-pulse" />
              ONLINE SYNC
            </div>
          </div>
        </div>

        <motion.button
          onMouseDown={startSosTimer} onMouseUp={cancelSosTimer} onMouseLeave={cancelSosTimer}
          onTouchStart={startSosTimer} onTouchEnd={cancelSosTimer}
          disabled={sosLoading}
          className={`
            relative overflow-hidden px-8 py-3 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 text-sm
            ${sosLoading ? "bg-slate-400" : "bg-gradient-to-r from-rose-500 to-red-600"}
          `}
        >
          <div className="flex items-center gap-2 relative z-10">
            <ShieldAlert size={18} className={sosProgress > 0 ? "animate-ping" : ""} />
            {sosLoading ? "SENDING..." : "HOLD FOR SOS"}
          </div>
          <div className="absolute left-0 top-0 h-full bg-white/20 transition-all ease-linear" style={{ width: `${sosProgress}%` }} />
        </motion.button>
      </header>

      {/* ── TOP METRICS STRIP ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Heart Rate", val: vitals?.heart_rate, unit: "BPM", icon: Heart, color: "rose", bg: "bg-rose-50" },
          { label: "SpO2 (Oxygen)", val: vitals?.spo2, unit: "%", icon: Droplets, color: "blue", bg: "bg-blue-50" },
          { label: "Temperature", val: vitals?.temperature, unit: "°C", icon: Thermometer, color: "amber", bg: "bg-amber-50" },
          { label: "Steps", val: vitals?.steps, unit: "steps", icon: Activity, color: "emerald", bg: "bg-emerald-50", sub: vitals?.activity }
        ].map((m, i) => (
          <GlassCard key={i} className="!p-4 flex items-center gap-4 border-none shadow-sm hover:shadow-md transition-shadow">
            <div className={`h-12 w-12 rounded-2xl ${m.bg} flex items-center justify-center flex-shrink-0 text-${m.color}-500`}>
              <m.icon size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 font-bold text-[10px] uppercase truncate">{m.label}</p>
              <h4 className="text-xl font-black text-slate-800 flex items-baseline gap-1">
                {m.val || "--"}<span className="text-[10px] text-slate-400 font-bold tracking-tighter">{m.unit}</span>
              </h4>
              {m.sub && <p className="text-[9px] font-bold text-emerald-600 uppercase bg-emerald-50 px-1.5 rounded-md inline-block">{m.sub}</p>}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── MAIN ANALYTICS GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Sidebar: Risk (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <GlassCard className="flex flex-col items-center justify-center py-10 relative overflow-hidden h-full">
            <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-8">Unified Risk Index</h3>
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="96" cy="96" r="80" stroke="#f1f5f9" strokeWidth="16" fill="transparent" />
                <motion.circle
                  cx="96" cy="96" r="80" stroke={getRiskColor(risk?.score || 0)} strokeWidth="16" fill="transparent"
                  strokeDasharray="502" initial={{ strokeDashoffset: 502 }}
                  animate={{ strokeDashoffset: 502 - (502 * (risk?.score || 0)) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }} strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-slate-800">{risk?.score || 0}</span>
                <span className="text-slate-400 font-bold text-[10px] uppercase">Safety Score</span>
              </div>
            </div>
            <div className="mt-8 w-full max-w-[240px] space-y-2">
              {risk?.breakdown && Object.entries(risk.breakdown).map(([key, val]) => (
                typeof val === 'number' && val > 0 && (
                  <div key={key} className="flex justify-between items-center text-[10px] bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-500 uppercase tracking-tighter text-[9px]">{key}</span>
                  <span className="font-black text-slate-700">{val}%</span>
                  </div>
                )
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Charts: Insights (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Heart Rate Chart */}
          <GlassCard className="!p-4 h-[240px]">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-slate-800 font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5">
                  <Heart size={12} className="text-rose-500" /> HR Trend (BPM)
                </h3>
                <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">Healthy Range: 60-100</span>
             </div>
             <div className="h-[160px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="recorded_at" tickFormatter={formatTime} hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 20px -5px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </GlassCard>

          {/* SpO2 Chart */}
          <GlassCard className="!p-4 h-[240px]">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-slate-800 font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5">
                  <Droplets size={12} className="text-blue-500" /> Oxygen Trend (%)
                </h3>
                <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">Safe: &gt;94%</span>
             </div>
             <div className="h-[160px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorSpo2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="recorded_at" tickFormatter={formatTime} hide />
                    <YAxis domain={[90, 100]} hide />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 20px -5px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="spo2" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSpo2)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </GlassCard>

          {/* Temperature Chart (Spans 2 cols for wide trend) */}
          <GlassCard className="!p-4 h-[240px] md:col-span-2">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-slate-800 font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5">
                  <Thermometer size={12} className="text-amber-500" /> Body Temperature Drift
                </h3>
                <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">Range: 36.2 - 37.2°C</span>
             </div>
             <div className="h-[160px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="recorded_at" tickFormatter={formatTime} tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#cbd5e1" />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 20px -5px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </GlassCard>

        </div>
      </div>

    </div>
  );
}
