import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { getReportHistory, ReportRecord } from "../utils/reportHistory";
import { Calendar, Bell, MoreVertical, Activity, ChevronDown, User, ArrowRight, Pill, FileText, TrendingUp, Search, Heart, Sparkles, Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_BASE_URL || "https://healthmate-api-2qu0.onrender.com";

interface MedicineStats {
  streak: number;
  today_taken: number;
  today_total: number;
  adherence_percent: number;
}

interface UpcomingMed {
  id: string;
  name: string;
  dosage: string;
  time: string;
  timeValue: string;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [fullName, setFullName] = useState<string>("");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [medStats, setMedStats] = useState<MedicineStats>({ streak: 0, today_taken: 0, today_total: 0, adherence_percent: 0 });
  const [upcomingMedicines, setUpcomingMedicines] = useState<UpcomingMed[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Latest report AI chat message
  const [latestAiMsg, setLatestAiMsg] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
  }, [user]);

  const getAuthToken = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Not authenticated");
    return data.session.access_token;
  };

  const loadDashboardData = async () => {
    setDataLoading(true);
    try {
      // 1. Get Token upfront to parallelize all API calls
      const token = await getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      // 2. Fire all requests in parallel
      const [profileRes, reportHistory, statsRes, medsRes, historyRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
        getReportHistory(),
        fetch(`${API_URL}/api/medicines/stats`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/medicines`, { headers }).catch(() => null),
        fetch(`${API_URL}/api2/history`, { headers }).catch(() => null)
      ]);

      // 3. Process Profile
      if (profileRes?.data) setFullName(profileRes.data.full_name);

      // 4. Process Reports
      setReports(reportHistory || []);

      // 5. Process Medicine Stats
      if (statsRes?.ok) {
        const statsData = await statsRes.json();
        setMedStats(statsData);
      }

      // 6. Process Medicine List
      if (medsRes?.ok) {
        const medsData = await medsRes.json();
        const meds = medsData.medicines || [];
        const upcoming: UpcomingMed[] = [];
        meds.forEach((m: any) => {
          (m.times || []).forEach((t: string) => {
            const [h, min] = t.split(":");
            let hours = parseInt(h, 10);
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12 || 12;
            upcoming.push({
              id: m.id,
              name: m.medicine_name,
              dosage: m.dosage,
              time: `Today at ${hours}:${min} ${ampm}`,
              timeValue: t,
            });
          });
        });
        upcoming.sort((a, b) => a.timeValue.localeCompare(b.timeValue));
        setUpcomingMedicines(upcoming);
      }

      // 7. Process AI History
      if (historyRes?.ok) {
        const historyData = await historyRes.json();
        const msgs = historyData.messages || [];
        const lastAi = [...msgs].reverse().find((m: any) => m.role === "assistant");
        if (lastAi) setLatestAiMsg(lastAi.content);
      }

    } catch (err) {
      console.warn("Dashboard load error:", err);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) return null;

  const firstName = fullName ? fullName.split(' ')[0] : "there";
  const reportCount = reports.length;

  // Compute health insights: count diseases with risk > 50%
  const healthInsights = reports.slice(0, 5).reduce((count, r) => {
    return count + Object.values(r.predictions).filter((p: any) => p.ran && parseFloat(p.risk_percent) > 50).length;
  }, 0);

  // Overall health status based on latest report
  const latestReport = reports[0];
  const getHealthStatus = () => {
    if (!latestReport) return { label: "No Data", badge: "New", color: "slate" };
    const risks = Object.values(latestReport.predictions).filter((p: any) => p.ran);
    if (risks.length === 0) return { label: "Stable", badge: "Good", color: "emerald" };
    const avgRisk = risks.reduce((sum: number, p: any) => sum + (p.risk_probability || 0), 0) / risks.length;
    if (avgRisk < 0.3) return { label: "Good", badge: "Good", color: "emerald" };
    if (avgRisk < 0.6) return { label: "Fair", badge: "Monitor", color: "amber" };
    return { label: "At Risk", badge: "Alert", color: "rose" };
  };
  const healthStatus = getHealthStatus();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 text-slate-800 animate-in fade-in duration-500">
      <div className="flex h-full">

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 px-6 lg:px-10 py-8 max-w-[1200px]">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-[2.25rem] font-bold tracking-tight text-slate-900 leading-tight">
                {getGreeting()}, {firstName}!
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1">Here's your health overview for today</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative">
                <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur border border-slate-200/60 hover:border-blue-200 hover:bg-blue-50/50 transition-all shadow-sm">
                  <Search size={18} className="text-slate-500" />
                </button>
              </div>
              <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur border border-slate-200/60 hover:border-blue-200 hover:bg-blue-50/50 transition-all shadow-sm">
                <Calendar size={18} className="text-slate-500" />
              </button>
              <button className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur border border-slate-200/60 hover:border-blue-200 hover:bg-blue-50/50 transition-all shadow-sm">
                <Bell size={18} className="text-slate-500" />
                {healthInsights > 0 && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>}
              </button>
              <Link to="/settings" className="flex items-center gap-2 ml-1 bg-white/80 backdrop-blur px-3 py-2 rounded-xl border border-slate-200/60 hover:border-blue-200 hover:bg-blue-50/50 shadow-sm transition-all">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
                  <User size={14} />
                </div>
                <ChevronDown size={14} className="text-slate-400" strokeWidth={2.5} />
              </Link>
            </div>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
              <Loader2 size={20} className="animate-spin" />
              <span className="font-bold text-sm">Loading dashboard...</span>
            </div>
          ) : (
            <>
              {/* 4 Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Overall Health */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.08)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-${healthStatus.color}-50 border border-${healthStatus.color}-100 flex items-center justify-center`}>
                      <Heart size={20} className={`text-${healthStatus.color}-500`} strokeWidth={1.8} />
                    </div>
                    <span className={`text-[11px] font-semibold text-${healthStatus.color}-600 bg-${healthStatus.color}-50 px-2 py-0.5 rounded-full border border-${healthStatus.color}-100`}>{healthStatus.badge}</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">{healthStatus.label}</h3>
                  <p className="text-slate-400 text-xs font-medium leading-snug">Overall Health</p>
                </motion.div>

                {/* Recent Reports */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.08)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center relative">
                      <FileText size={20} className="text-blue-500" strokeWidth={1.8} />
                      {reportCount > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>}
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{reportCount > 0 ? "Active" : "None"}</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">{reportCount}</h3>
                  <p className="text-slate-400 text-xs font-medium leading-snug">Reports Analyzed</p>
                </motion.div>

                {/* Health Insights */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.08)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                      <Sparkles size={20} className="text-amber-500" strokeWidth={1.8} />
                    </div>
                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">{healthInsights > 0 ? `${healthInsights} flags` : "Clear"}</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">{healthInsights}</h3>
                  <p className="text-slate-400 text-xs font-medium leading-snug">Risk Flags</p>
                </motion.div>

                {/* Medication Adherence */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.08)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                      <Pill size={20} className="text-violet-500" strokeWidth={1.8} />
                    </div>
                    <span className="text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">{medStats.adherence_percent}%</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">{medStats.today_taken} / {medStats.today_total || "—"}</h3>
                  <p className="text-slate-400 text-xs font-medium leading-snug">Medication Today</p>
                </motion.div>
              </div>

              {/* Chart + Small Metric Cards Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Small stacked cards */}
                <div className="flex flex-col gap-4">
                  <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] flex-1 flex flex-col justify-center hover:shadow-[0_8px_30px_rgba(59,130,246,0.08)] transition-all duration-300">
                    <h4 className="text-slate-500 text-xs font-semibold tracking-wide uppercase mb-2">Lab Values Tracked</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-extrabold text-slate-900">
                        {latestReport ? Object.keys(latestReport.extractedData).length : 0}
                      </span>
                      {latestReport && (
                        <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
                          <TrendingUp size={11} /> Latest
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] flex-1 flex flex-col justify-center hover:shadow-[0_8px_30px_rgba(59,130,246,0.08)] transition-all duration-300">
                    <h4 className="text-slate-500 text-xs font-semibold tracking-wide uppercase mb-2">Medicine Streak</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-extrabold text-slate-900">{medStats.streak}</span>
                      <span className="bg-rose-50 text-rose-600 text-[11px] font-bold px-2.5 py-1 rounded-full border border-rose-100">days</span>
                    </div>
                  </div>
                </div>

                {/* Disease Risk Overview Card */}
                <div className="lg:col-span-2 bg-white rounded-[20px] p-6 lg:p-8 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] relative min-h-[300px] flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <h4 className="font-bold text-slate-900 text-lg">Latest Risk Analysis</h4>
                    {latestReport && (
                      <span className="text-slate-400 text-xs font-semibold bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        {new Date(latestReport.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>

                  {latestReport ? (
                    <div className="flex-1 flex flex-col gap-4">
                      {Object.entries(latestReport.predictions)
                        .filter(([, p]: [string, any]) => p.ran)
                        .map(([disease, pred]: [string, any]) => {
                          const riskPct = pred.risk_probability * 100;
                          const barColor = riskPct > 60 ? "bg-rose-500" : riskPct > 30 ? "bg-amber-400" : "bg-emerald-400";
                          return (
                            <div key={disease}>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-sm font-semibold text-slate-700">{disease.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                                <span className="text-sm font-bold text-slate-900">{pred.risk_percent}</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${riskPct}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                  className={`h-full rounded-full ${barColor}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      {Object.values(latestReport.predictions).filter((p: any) => p.ran).length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">
                          No disease predictions ran for this report
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">
                      Upload a report to see risk analysis
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Reports Table */}
              <div className="bg-white rounded-[20px] p-6 lg:p-8 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] mb-8">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-bold text-slate-900 text-lg">Recent Reports</h4>
                  <Link to="/risk-predictor" className="text-blue-500 text-sm font-semibold hover:text-blue-600 transition-colors flex items-center gap-1">
                    Upload new <ArrowRight size={14} />
                  </Link>
                </div>

                {reports.length === 0 ? (
                  <div className="text-slate-400 font-medium px-4 py-10 bg-slate-50/80 border border-dashed border-slate-200 rounded-2xl text-center text-sm">
                    No reports yet. Upload your first medical report to get started.
                  </div>
                ) : (
                  <>
                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 pb-3 border-b border-slate-100">
                      <div className="col-span-5">Report</div>
                      <div className="col-span-3">Status</div>
                      <div className="col-span-4 text-right">Date</div>
                    </div>

                    {reports.slice(0, 5).map((report) => (
                      <Link
                        key={report.id}
                        to={`/report-history/${report.id}`}
                        className="grid grid-cols-12 gap-4 items-center px-4 py-4 border-b border-slate-50 hover:bg-blue-50/30 rounded-xl transition-colors"
                      >
                        <div className="col-span-5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                            <FileText size={16} />
                          </div>
                          <span className="text-slate-900 font-semibold text-sm truncate">{report.name}</span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Analyzed</span>
                        </div>
                        <div className="col-span-4 text-right text-slate-400 font-medium text-sm">{formatDate(report.timestamp)}</div>
                      </Link>
                    ))}
                  </>
                )}
              </div>

              {/* Upcoming Medicines + Doctor Meeting row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Upcoming Medicines */}
                <div className="bg-white rounded-[20px] p-6 border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold text-slate-900 text-lg">Upcoming Medicines</h3>
                    <Link to="/medicine-scheduler" className="text-blue-500 text-xs font-bold hover:text-blue-600 transition-colors">
                      Manage →
                    </Link>
                  </div>
                  <div className="flex flex-col gap-3">
                    {upcomingMedicines.length === 0 ? (
                      <div className="text-slate-400 font-medium px-4 py-6 bg-slate-50/80 border border-dashed border-slate-200 rounded-2xl text-center text-sm">
                        No medicines scheduled. Add some in the Medicine Scheduler.
                      </div>
                    ) : (
                      upcomingMedicines.slice(0, 4).map((med, idx) => (
                        <div key={idx} className="flex items-center gap-4 group cursor-pointer p-3 rounded-2xl hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex flex-shrink-0 items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.25)] group-hover:-translate-y-0.5 transition-transform">
                            <Pill size={20} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 leading-tight mb-0.5 text-sm">Take {med.name} {med.dosage && `(${med.dosage})`}</h4>
                            <span className="text-slate-400 text-xs font-medium">{med.time}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quick Actions Card */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[20px] p-6 text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold tracking-tight text-lg mb-2">Quick Actions</h3>
                    <p className="text-slate-400 font-medium text-sm leading-relaxed mb-4">Jump into your health tools</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link to="/risk-predictor" className="bg-white/10 backdrop-blur border border-white/10 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2">
                      <FileText size={16} /> Upload Report
                    </Link>
                    <Link to="/ai-companion" className="bg-white/10 backdrop-blur border border-white/10 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2">
                      <Sparkles size={16} /> Ask AI Doctor
                    </Link>
                    <Link to="/medicine-scheduler" className="bg-white/10 backdrop-blur border border-white/10 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2">
                      <Pill size={16} /> Medicine Scheduler
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── AI COMPANION RIGHT PANEL ── */}
        <div className="hidden xl:flex w-80 flex-col py-8 pr-6 pl-2">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] flex flex-col flex-1 overflow-hidden">
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">AI Companion</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.8)]"></div>
                    <span className="text-blue-100 text-[10px] font-medium">Online</span>
                  </div>
                </div>
              </div>
              <button className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <MoreVertical size={16} className="text-white" />
              </button>
            </div>

            {/* Chat area */}
            <div className="flex-1 px-4 py-5 overflow-y-auto flex flex-col gap-4">
              {latestAiMsg ? (
                <>
                  <div className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <div className="bg-slate-50 rounded-2xl rounded-tl-md px-4 py-3 text-[13px] text-slate-700 font-medium leading-relaxed border border-slate-100 max-w-[85%]">
                      {latestAiMsg.length > 200 ? latestAiMsg.slice(0, 200) + "..." : latestAiMsg}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <div className="bg-slate-50 rounded-2xl rounded-tl-md px-4 py-3 text-[13px] text-slate-700 font-medium leading-relaxed border border-slate-100 max-w-[85%]">
                    Hello! I'm your AI health companion. Ask me about your reports, symptoms, or general health questions.
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="px-4 pb-4 pt-2 border-t border-slate-100">
              <Link to="/ai-companion" className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl hover:border-blue-300 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all group">
                <input type="text" placeholder="Ask a medical question..." className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium placeholder:text-slate-400 text-slate-700 pointer-events-none" />
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center group-hover:shadow-[0_4px_12px_rgba(59,130,246,0.35)] transition-shadow">
                  <Send size={14} strokeWidth={2.5} />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
