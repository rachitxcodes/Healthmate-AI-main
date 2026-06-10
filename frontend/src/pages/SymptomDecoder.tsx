import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShieldAlert, RefreshCw, CheckCircle2,
  X, AlertTriangle, TrendingUp, Clock, Wifi
} from "lucide-react";
import { useDebounce } from "../hooks/use-debounce";
import { useAuth } from "../contexts/AuthContext";

// ─── Symptom data ───────────────────────────────────────────────────────────
const SYMPTOM_DATA = [
  { name: "Chest Pain",          weight: 30, level: "Critical", icon: "❤️" },
  { name: "Shortness of Breath", weight: 25, level: "Critical", icon: "💨" },
  { name: "Dizziness",           weight: 20, level: "High",     icon: "🌀" },
  { name: "Extreme Fatigue",     weight: 20, level: "High",     icon: "⚡" },
  { name: "Fever",               weight: 15, level: "Medium",   icon: "🌡️" },
  { name: "Fatigue",             weight: 15, level: "Medium",   icon: "😴" },
  { name: "Persistent Cough",    weight: 10, level: "Medium",   icon: "😮‍💨" },
  { name: "Nausea",              weight: 10, level: "Medium",   icon: "🤢" },
  { name: "Body Aches",          weight: 10, level: "Medium",   icon: "🦴" },
  { name: "Chills",              weight: 10, level: "Medium",   icon: "🥶" },
  { name: "Weakness",            weight: 10, level: "Medium",   icon: "💪" },
  { name: "Headache",            weight:  5, level: "Low",      icon: "🧠" },
  { name: "Sore Throat",         weight:  5, level: "Low",      icon: "🗣️" },
  { name: "Loss of Appetite",    weight:  5, level: "Low",      icon: "🍽️" },
];

const LEVEL_STYLES: Record<string, string> = {
  Critical: "bg-rose-50 text-rose-600 border-rose-200",
  High:     "bg-amber-50 text-amber-600 border-amber-200",
  Medium:   "bg-blue-50 text-blue-600 border-blue-200",
  Low:      "bg-slate-50 text-slate-500 border-slate-200",
};

const GAUGE_COLOR = (score: number) => {
  if (score >= 40) return "#f43f5e";
  if (score >= 20) return "#f59e0b";
  return "#10b981";
};

const RISK_LABEL = (score: number) => {
  if (score >= 40) return { label: "Critical Hazard", color: "text-rose-600" };
  if (score >= 20) return { label: "Moderate Hazard", color: "text-amber-600" };
  if (score >   0) return { label: "Low Hazard",      color: "text-blue-600" };
  return             { label: "No Symptoms",           color: "text-emerald-500" };
};

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ─── Component ───────────────────────────────────────────────────────────────
export default function SymptomDecoder() {
  const { user } = useAuth();

  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery]   = useState("");
  const [syncing, setSyncing]           = useState(false);
  const [synced, setSynced]             = useState(false);
  const [loadingPrev, setLoadingPrev]   = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncedSet, setSyncedSet]       = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  const debouncedQuery = useDebounce(searchQuery, 200);

  // ── Load previously synced symptoms on mount ─────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setLoadingPrev(false);
      return;
    }
    fetch(`${API_URL}/api/latest?user_id=${encodeURIComponent(user.id)}`)
      .then(r => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then(data => {
        if (Array.isArray(data.symptoms) && data.symptoms.length > 0) {
          const names = new Set<string>(data.symptoms as string[]);
          setSelected(names);
          setSyncedSet(names);
          setSynced(true);
          setLastSyncedAt(data.synced_at ?? null);
        }
      })
      .catch(() => { /* no previous data — start fresh */ })
      .finally(() => setLoadingPrev(false));
  }, [user?.id]);  // only re-run when user id changes

  // ── Live score ───────────────────────────────────────────────────────────
  const liveSummary = useMemo(() => {
    let total = 0;
    const breakdown: { name: string; weight: number; icon: string }[] = [];
    for (const name of selected) {
      const s = SYMPTOM_DATA.find(x => x.name === name);
      if (s) {
        total += s.weight;
        breakdown.push({ name: s.name, weight: s.weight, icon: s.icon });
      }
    }
    return { total: Math.min(100, total), breakdown };
  }, [selected]);

  // ── Unsaved change detection ─────────────────────────────────────────────
  const hasUnsyncedChanges = useMemo(() => {
    if (selected.size !== syncedSet.size) return true;
    for (const s of selected) {
      if (!syncedSet.has(s)) return true;
    }
    return false;
  }, [selected, syncedSet]);

  // ── Toggle ───────────────────────────────────────────────────────────────
  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setSynced(false);
    setErrorMsg(null);
  };

  // ── Sync to backend ──────────────────────────────────────────────────────
  const syncToRiskEngine = async () => {
    if (!user?.id) {
      setErrorMsg("You must be signed in to sync symptoms.");
      return;
    }
    setSyncing(true);
    setErrorMsg(null);
    try {
      const resp = await fetch(`${API_URL}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: [...selected], user_id: user.id }),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        throw new Error(detail || "Sync failed");
      }
      setSynced(true);
      setSyncedSet(new Set(selected));
      setLastSyncedAt(new Date().toISOString());
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Failed to sync. Check backend connection.");
    } finally {
      setSyncing(false);
    }
  };

  const filteredSymptoms = SYMPTOM_DATA.filter(s =>
    s.name.toLowerCase().includes(debouncedQuery.toLowerCase())
  );
  const riskInfo    = RISK_LABEL(liveSummary.total);
  const gaugeOffset = 264 - (264 * liveSummary.total) / 100;

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-4 sm:px-6 pt-4 pb-24 max-w-[1400px] mx-auto">

      {/* HEADER */}
      <div className="mb-8 mt-4 md:mt-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
          Symptom Decoder
        </h1>
        <p className="text-slate-500 font-semibold mt-1">
          Tap a symptom to add — tap again to remove. Score updates live.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ── LEFT : Selector ─────────────────────────────────────────── */}
        <div className="xl:col-span-7 flex flex-col gap-4">

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search symptoms..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all font-medium placeholder:text-slate-400 shadow-sm"
            />
          </div>

          {/* Active banner */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="flex flex-wrap gap-2 flex-1">
                  {[...selected].map(name => {
                    const sym = SYMPTOM_DATA.find(s => s.name === name);
                    const isSynced = syncedSet.has(name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggle(name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-full transition-colors group border ${
                          isSynced
                            ? "bg-emerald-500/30 border-emerald-400/40"
                            : "bg-white/10 border-white/10"
                        } hover:bg-rose-500/80 hover:border-transparent`}
                      >
                        <span>{sym?.icon}</span>
                        {name}
                        {isSynced && <Wifi size={9} className="opacity-60" />}
                        <X size={10} className="opacity-40 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => { setSelected(new Set()); setSynced(false); setErrorMsg(null); }}
                  className="text-slate-400 hover:text-white text-xs font-bold transition-colors whitespace-nowrap"
                >
                  Clear All
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Symptom grid */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Symptom Directory · Tap to Toggle
            </span>

            {loadingPrev ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm font-semibold">
                <RefreshCw size={16} className="animate-spin" />
                Restoring your last session...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredSymptoms.map(s => {
                  const isActive = selected.has(s.name);
                  const isSynced = syncedSet.has(s.name);
                  return (
                    <motion.button
                      key={s.name}
                      onClick={() => toggle(s.name)}
                      whileTap={{ scale: 0.97 }}
                      className={`relative p-3.5 rounded-xl border text-left transition-all duration-150 ${
                        isActive
                          ? "bg-slate-900 border-slate-700 shadow-md"
                          : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
                      }`}
                    >
                      {/* Indicator dot */}
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${
                            isSynced ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                      )}
                      <span className="text-lg mb-1 block">{s.icon}</span>
                      <span className={`block text-sm font-bold mb-1.5 ${isActive ? "text-white" : "text-slate-700"}`}>
                        {s.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md border ${
                          isActive ? "bg-white/10 text-slate-300 border-white/10" : LEVEL_STYLES[s.level]
                        }`}>
                          {s.level}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          +{s.weight} pts
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
                {filteredSymptoms.length === 0 && (
                  <p className="col-span-3 text-center py-8 text-slate-400 font-semibold text-sm">
                    No symptoms match "{debouncedQuery}".
                  </p>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                Synced to Vitals
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                <div className="w-2 h-2 bg-amber-400 rounded-full" />
                Selected, not yet synced
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT : Live Hazard Panel ────────────────────────────────── */}
        <div className="xl:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 sticky top-6 flex flex-col gap-6">

            {/* Title */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-xl text-slate-900">Live Hazard Score</h3>
                {lastSyncedAt && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-bold">
                    <Clock size={10} />
                    Last synced at {formatTime(lastSyncedAt)}
                  </div>
                )}
              </div>
              <ShieldAlert size={22} className="text-slate-300 mt-0.5" />
            </div>

            {/* Gauge */}
            <div className="flex flex-col items-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="66" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                  <motion.circle
                    cx="80" cy="80" r="66"
                    stroke={GAUGE_COLOR(liveSummary.total)}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray="264"
                    animate={{ strokeDashoffset: gaugeOffset }}
                    transition={{ type: "spring", stiffness: 80, damping: 18 }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    key={liveSummary.total}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-4xl font-black text-slate-800"
                  >
                    {liveSummary.total}
                  </motion.span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Risk Pts</span>
                </div>
              </div>

              <motion.p
                key={riskInfo.label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-3 text-base font-black ${riskInfo.color}`}
              >
                {riskInfo.label}
              </motion.p>

              <p className={`text-[11px] font-semibold mt-1 text-center leading-relaxed ${
                hasUnsyncedChanges ? "text-amber-500" : "text-slate-400"
              }`}>
                {hasUnsyncedChanges
                  ? "⚠️ Unsaved changes — sync to update your Vitals."
                  : "Reflected in your Unified Safety Index."}
              </p>
            </div>

            {/* Breakdown */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Contribution Breakdown
              </span>
              <AnimatePresence mode="popLayout">
                {liveSummary.breakdown.length === 0 ? (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-6 text-sm text-slate-300 font-bold border-2 border-dashed border-slate-100 rounded-xl"
                  >
                    No symptoms selected
                  </motion.p>
                ) : (
                  [...liveSummary.breakdown]
                    .sort((a, b) => b.weight - a.weight)
                    .map(row => {
                      const isSynced = syncedSet.has(row.name);
                      return (
                        <motion.div
                          key={row.name}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={`flex items-center gap-3 p-3 rounded-xl border group ${
                            isSynced
                              ? "bg-emerald-50/60 border-emerald-100"
                              : "bg-amber-50/60 border-amber-100"
                          }`}
                        >
                          <span className="text-base flex-shrink-0">{row.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-slate-700 truncate">{row.name}</span>
                                {isSynced && <Wifi size={9} className="text-emerald-500 flex-shrink-0" />}
                              </div>
                              <span className="text-xs font-black text-rose-500 ml-2 flex-shrink-0">
                                +{row.weight} pts
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(row.weight / 30) * 100}%` }}
                                className={`h-full rounded-full ${
                                  isSynced
                                    ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                                    : "bg-gradient-to-r from-amber-400 to-amber-500"
                                }`}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => toggle(row.name)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-rose-50 flex-shrink-0"
                            aria-label={`Remove ${row.name}`}
                          >
                            <X size={12} className="text-rose-400" />
                          </button>
                        </motion.div>
                      );
                    })
                )}
              </AnimatePresence>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold">
                <AlertTriangle size={14} className="flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Sync button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                id="sync-to-health-index-btn"
                onClick={syncToRiskEngine}
                disabled={syncing || (!hasUnsyncedChanges && synced && selected.size > 0) || liveSummary.total === 0}
                className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
                  synced && !hasUnsyncedChanges
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : hasUnsyncedChanges
                    ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300"
                    : liveSummary.total === 0
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-200"
                }`}
              >
                {syncing
                  ? <><RefreshCw size={16} className="animate-spin" /> Syncing...</>
                  : synced && !hasUnsyncedChanges
                  ? <><CheckCircle2 size={16} /> Synced to Vitals Dashboard</>
                  : <><TrendingUp size={16} /> {hasUnsyncedChanges ? "Update Health Index" : "Sync to Multi-Risk Engine"}</>
                }
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-2 font-semibold">
                Syncing updates your Safety Score on the Vitals Dashboard.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}