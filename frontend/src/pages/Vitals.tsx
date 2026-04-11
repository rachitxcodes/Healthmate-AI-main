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

      // 1. Fetch Latest Vitals
      const vitalsResp = await fetch(`${API_BASE_URL}/api3/vitals/latest`, { headers });
      if (vitalsResp.ok) {
        const vitalsData = await vitalsResp.json();
        setVitals(vitalsData);
      } else {
        setVitals(null);
      }

      // 2. Fetch Risk Score
      const riskResp = await fetch(`${API_BASE_URL}/api3/risk-score`, { headers });
      if (riskResp.ok) {
        const riskData = await riskResp.json();
        setRisk(riskData);
      } else {
        setRisk(null);
      }

      // 3. Fetch History (last 24h)
      const historyResp = await fetch(`${API_BASE_URL}/api3/vitals/history?hours=24`, { headers });
      if (historyResp.ok) {
        const historyData = await historyResp.json();
        setHistory(historyData.readings || []);
      } else {
        setHistory([]);
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Vitals fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // --- SOS Logic ---
  const startSosTimer = () => {
    setSosProgress(0);
    const step = 2; // progress step
    sosTimerRef.current = setInterval(() => {
      setSosProgress(prev => {
        if (prev >= 100) {
          triggerSos();
          clearInterval(sosTimerRef.current);
          return 100;
        }
        return prev + step;
      });
    }, 50); // ~2.5 seconds to fill
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
    if (score >= 71) return "#f43f5e"; // rose-500
    if (score >= 41) return "#f59e0b"; // amber-500
    return "#10b981"; // emerald-500
  };

  if (isLoading && !vitals) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full"
        />
        <p className="text-slate-400 font-bold animate-pulse">Initializing Health Monitor...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 lg:p-12 max-w-7xl mx-auto space-y-10">

      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Vitals & Risk</h1>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm ${getStatusColor(risk?.status)}`}>
              {risk?.status || "Analyzing"}
            </span>
            <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold bg-white border border-slate-100 px-3 py-1.5 rounded-xl">
              <Clock size={14} />
              {vitals?.is_stale ? "Stale Data (Sensor Offline)" : "Live"}
            </div>
          </div>
        </div>

        {/* SOS Button with Long Press */}
        <div className="relative group">
          <motion.button
            onMouseDown={startSosTimer}
            onMouseUp={cancelSosTimer}
            onMouseLeave={cancelSosTimer}
            onTouchStart={startSosTimer}
            onTouchEnd={cancelSosTimer}
            disabled={sosLoading}
            className={`
              relative overflow-hidden px-10 py-4 rounded-[2rem] font-black text-white shadow-2xl transition-all active:scale-95
              ${sosLoading ? "bg-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-rose-500 to-red-600 hover:shadow-rose-500/30"}
            `}
          >
            <div className="flex items-center gap-3 relative z-10">
              <ShieldAlert size={20} className={sosProgress > 0 ? "animate-ping" : ""} />
              {sosLoading ? "SENDING..." : "HOLD FOR SOS"}
            </div>
            {/* Progress Overlay */}
            <div
              className="absolute left-0 top-0 h-full bg-white/20 transition-all ease-linear"
              style={{ width: `${sosProgress}%` }}
            />
          </motion.button>
          <p className="absolute -bottom-6 left-0 w-full text-center text-[10px] text-slate-400 font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
            Emergency Contacts will be notified
          </p>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left: Risk Score Gauge (4 cols) */}
        <GlassCard className="lg:col-span-5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
            <AlertTriangle size={80} className="text-slate-200" />
          </div>

          <h3 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-10 w-full text-center">Unified Risk Index</h3>

          <div className="relative w-64 h-64 flex items-center justify-center mb-10">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full -rotate-90">
              <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="20" fill="transparent" className="text-slate-50" />
              <motion.circle
                cx="128" cy="128" r="110"
                stroke={getRiskColor(risk?.score || 0)}
                strokeWidth="20"
                fill="transparent"
                strokeDasharray="691"
                initial={{ strokeDashoffset: 691 }}
                animate={{ strokeDashoffset: 691 - (691 * (risk?.score || 0)) / 100 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-6xl font-black text-slate-800"
              >
                {risk?.score || 0}
              </motion.span>
              <span className="text-slate-400 font-bold text-sm">/ 100</span>
            </div>
          </div>

          <div className="w-full space-y-3 pb-4">
            {risk?.breakdown && Object.entries(risk.breakdown).map(([key, val]) => (
              typeof val === 'number' && val > 0 && (
                <div key={key} className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                  <span className="text-xs font-bold text-slate-500 capitalize">{key.replace('_points', '')} contribution</span>
                  <span className="text-xs font-black text-slate-700">+{val} pts</span>
                </div>
              )
            ))}
            {!risk?.breakdown && <p className="text-xs text-slate-400 italic text-center py-4">Waiting for detailed analysis...</p>}
          </div>
        </GlassCard>

        {/* Right: Vitals Grid (8 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Heart Rate Card */}
          <GlassCard className="!p-6 flex items-center gap-6 group hover:translate-y-[-4px]">
            <div className="h-16 w-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Heart size={32} />
            </div>
            <div>
              <p className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-0.5">Heart Rate</p>
              <h4 className="text-3xl font-black text-slate-800">
                {vitals?.heart_rate || "--"}<span className="text-sm text-slate-400 ml-1">BPM</span>
              </h4>
            </div>
          </GlassCard>

          {/* SpO2 Card */}
          <GlassCard className="!p-6 flex items-center gap-6 group hover:translate-y-[-4px]">
            <div className="h-16 w-16 rounded-3xl bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Droplets size={32} />
            </div>
            <div>
              <p className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-0.5">SpO2</p>
              <h4 className="text-3xl font-black text-slate-800">
                {vitals?.spo2 || "--"}<span className="text-sm text-slate-400 ml-1">%</span>
              </h4>
            </div>
          </GlassCard>

          {/* Temperature Card */}
          <GlassCard className="!p-6 flex items-center gap-6 group hover:translate-y-[-4px]">
            <div className="h-16 w-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Thermometer size={32} />
            </div>
            <div>
              <p className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-0.5">Temperature</p>
              <h4 className="text-3xl font-black text-slate-800">
                {vitals?.temperature || "--"}<span className="text-sm text-slate-400 ml-1">°C</span>
              </h4>
            </div>
          </GlassCard>

          {/* Activity / Steps Card */}
          <GlassCard className="!p-6 flex items-center gap-6 group hover:translate-y-[-4px]">
            <div className="h-16 w-16 rounded-3xl bg-emerald-50 text-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Activity size={32} />
            </div>
            <div>
              <p className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-0.5">Daily Steps</p>
              <h4 className="text-3xl font-black text-slate-800">
                {vitals?.steps || "0"}<span className="text-sm text-slate-400 ml-1">steps</span>
              </h4>
              <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase bg-emerald-100/50 px-2 py-0.5 rounded-full inline-block">
                {vitals?.activity || "Stable"}
              </p>
            </div>
          </GlassCard>

          {/* Report Context Card */}
          <GlassCard className="!p-6 flex items-center gap-6 group hover:translate-y-[-4px] bg-slate-900 !border-slate-800">
            <div className="h-16 w-16 rounded-3xl bg-white/10 text-white flex items-center justify-center flex-shrink-0 group-hover:rotate-12 transition-transform">
              <History size={32} />
            </div>
            <div>
              <p className="text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-0.5">Report Link</p>
              <p className="text-white font-bold text-sm leading-tight flex items-center gap-2">
                {risk?.report_available ? "AI analyzing disease context" : "No report found"}
                <ChevronRight size={14} />
              </p>
            </div>
          </GlassCard>

          {/* Trend Chart (Spans 2 cols) */}
          <div className="sm:col-span-2">
            <GlassCard className="!p-6 h-[340px]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-slate-800 font-black flex items-center gap-2 uppercase text-xs tracking-widest">
                  <Activity size={16} className="text-blue-500" /> Vitals History (24h)
                </h3>
                <div className="flex gap-4 text-[10px] font-bold text-slate-400">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> BPM</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> SpO2</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Temp °C</span>
                </div>
              </div>

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorSpo2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="recorded_at"
                      hide
                    />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                    />
                    <Area type="monotone" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" dot={false} />
                    <Area type="monotone" dataKey="spo2" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSpo2)" dot={false} />
                    <Area type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* ── FOOTER GUIDANCE ── */}
      <footer className="bg-blue-50/50 rounded-[2.5rem] p-8 border border-blue-100/50 flex flex-col md:flex-row gap-8 items-center justify-between">
        <div className="flex gap-6 items-center flex-1">
          <div className="bg-white p-4 rounded-[1.5rem] shadow-sm flex-shrink-0 text-blue-500">
            <Info size={32} />
          </div>
          <div>
            <h4 className="text-slate-800 font-black mb-1">How the score works</h4>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xl">
              HealthMate AI combines live vitals from your wearable with historical medical reports and current symptoms to generate a unified risk score.
              Scores above 70 trigger automated caregiver alerts.
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="text-blue-600 font-bold bg-white px-8 py-3 rounded-2xl border border-blue-200 hover:bg-blue-50 transition-colors shadow-sm whitespace-nowrap"
        >
          Check Now
        </button>
      </footer>

    </div>
  );
}
