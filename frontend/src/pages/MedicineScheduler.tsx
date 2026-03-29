import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Flame, Clock, Calendar, Check, Pill, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";

const API_URL = import.meta.env.VITE_API_BASE_URL || "https://healthmate-api-2qu0.onrender.com";

type Frequency = "daily" | "alternate" | "every_x_hours";

interface Medicine {
  id: string;
  medicine_name: string;
  dosage: string;
  doses_per_day: number;
  times: string[];
  start_date: string | null;
  end_date: string | null;
  frequency: string;
  every_hours: number | null;
  is_active: boolean;
  created_at: string;
}

interface Stats {
  streak: number;
  today_taken: number;
  today_total: number;
  adherence_percent: number;
}

export default function MedicineScheduler() {
  // Form state
  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosesPerDay, setDosesPerDay] = useState("1");
  const [times, setTimes] = useState([""]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [everyHours, setEveryHours] = useState("");

  // Data state
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stats, setStats] = useState<Stats>({ streak: 0, today_taken: 0, today_total: 0, adherence_percent: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [takingId, setTakingId] = useState<string | null>(null);

  const getAuthToken = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Not authenticated");
    return data.session.access_token;
  };

  // Fetch medicines + stats on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [medsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/medicines`, { headers }),
        fetch(`${API_URL}/api/medicines/stats`, { headers }),
      ]);

      if (medsRes.ok) {
        const medsData = await medsRes.json();
        setMedicines(medsData.medicines || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.warn("Failed to load medicine data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (value: string, index: number) => {
    setTimes((prev) => { const c = [...prev]; c[index] = value; return c; });
  };

  const handleSubmit = async () => {
    if (!medicineName.trim()) return alert("Please enter a medicine name.");
    if (!dosage.trim()) return alert("Please enter dosage.");
    if (times.some((t) => !t.trim())) return alert("Please fill all reminder times.");

    setSaving(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/medicines`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          medicine_name: medicineName.trim(),
          dosage: dosage.trim(),
          doses_per_day: parseInt(dosesPerDay),
          times,
          start_date: startDate || null,
          end_date: endDate || null,
          frequency,
          every_hours: frequency === "every_x_hours" ? parseInt(everyHours) || null : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      // Reset form
      setMedicineName("");
      setDosage("");
      setDosesPerDay("1");
      setTimes([""]);
      setStartDate("");
      setEndDate("");
      setFrequency("daily");
      setEveryHours("");

      // Reload data
      await loadData();
    } catch (err) {
      alert("Failed to save medicine. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = await getAuthToken();
      await fetch(`${API_URL}/api/medicines/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setMedicines((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleTake = async (medicine: Medicine, time: string) => {
    const key = `${medicine.id}-${time}`;
    setTakingId(key);
    try {
      const token = await getAuthToken();
      await fetch(`${API_URL}/api/medicines/${medicine.id}/take`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scheduled_time: time }),
      });
      await loadData();
    } catch (err) {
      console.error("Take failed:", err);
    } finally {
      setTakingId(null);
    }
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
  };

  const inputClass = "mt-2 w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition-all font-medium";
  const labelClass = "text-sm font-semibold text-slate-700 tracking-wide";

  return (
    <div className="w-full text-text-primary px-6 pt-4 pb-24 max-w-[1000px] mx-auto">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 mt-4 md:mt-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Medicine Scheduler</h1>
            <p className="text-slate-600 mt-1 font-medium">Track your medicine timings and stay consistent.</p>
          </div>
          <motion.div
            initial={{ scale: 0.9 }} animate={{ scale: 1 }}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 px-4 py-2 rounded-xl shadow-sm self-start sm:self-auto"
          >
            <Flame size={18} className="text-rose-500" />
            <span className="font-bold text-sm tracking-wide">
              {loading ? "..." : `${stats.streak} Day Streak`}
            </span>
          </motion.div>
        </div>

        {/* Stats Bar */}
        {!loading && stats.today_total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-4"
          >
            <div className="flex items-center gap-2 flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Check size={20} className="text-emerald-500" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-slate-900">{stats.today_taken}/{stats.today_total}</span>
                <p className="text-xs text-slate-500 font-medium">Doses today</p>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-100" />
            <div className="flex items-center gap-2 flex-1">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                <Pill size={20} className="text-violet-500" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-slate-900">{stats.adherence_percent}%</span>
                <p className="text-xs text-slate-500 font-medium">Adherence</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Saved Medicines List */}
        {!loading && medicines.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Your Medicines</h2>
            <AnimatePresence>
              {medicines.map((med) => (
                <motion.div
                  key={med.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Pill size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-tight">{med.medicine_name}</h3>
                        <p className="text-slate-500 text-xs font-medium mt-0.5">{med.dosage} · {med.frequency.replace(/_/g, " ")} · {med.doses_per_day}x/day</p>
                        <div className="flex gap-1.5 flex-wrap mt-2">
                          {med.times.map((t, i) => (
                            <button
                              key={i}
                              onClick={() => handleTake(med, t)}
                              disabled={takingId === `${med.id}-${t}`}
                              className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              {takingId === `${med.id}-${t}` ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              {formatTime(t)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(med.id)}
                      className="p-2.5 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span className="font-bold text-sm">Loading medicines...</span>
          </div>
        )}

        {/* Form Container */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-rose-100 bg-white p-8 sm:p-10 shadow-[0_8px_40px_rgba(0,0,0,0.04)] space-y-6"
        >
          <h2 className="text-lg font-bold text-slate-800">Add New Medicine</h2>

          {/* Medicine Name & Dosage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Medicine Name</label>
              <input type="text" value={medicineName} onChange={(e) => setMedicineName(e.target.value)}
                placeholder="e.g., Metformin 500mg" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Dosage</label>
              <input type="text" value={dosage} onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g., 1 tablet" className={inputClass} />
            </div>
          </div>

          {/* Doses per day & Frequency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Doses per Day</label>
              <select value={dosesPerDay} onChange={(e) => setDosesPerDay(e.target.value)}
                className={inputClass + " cursor-pointer"}>
                {["1", "2", "3", "4", "5"].map(n => <option key={n} value={n}>{n} dose{n !== "1" ? "s" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}
                className={inputClass + " cursor-pointer"}>
                <option value="daily">Daily</option>
                <option value="alternate">Alternate Days</option>
                <option value="every_x_hours">Every X Hours</option>
              </select>
              {frequency === "every_x_hours" && (
                <motion.input initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  type="number" value={everyHours} onChange={(e) => setEveryHours(e.target.value)}
                  placeholder="e.g., 8 (for every 8 hours)" className={inputClass + " mt-3"} />
              )}
            </div>
          </div>

          {/* Reminder Times */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-slate-400" />
              <label className={labelClass}>Reminder Times</label>
            </div>
            <div className="space-y-3">
              {times.map((time, index) => (
                <motion.div key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                  <input type="time" value={time} onChange={(e) => handleTimeChange(e.target.value, index)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition-all font-medium" />
                  {index > 0 && (
                    <button onClick={() => setTimes(prev => prev.filter((_, i) => i !== index))}
                      className="p-3 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>

            <button onClick={() => setTimes(prev => [...prev, ""])}
              className="mt-4 flex items-center justify-center gap-2 w-full sm:w-auto bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-5 py-2.5 rounded-xl transition-colors font-bold text-sm">
              <Plus size={16} /> Add Another Time
            </button>
          </div>

          {/* Start & End Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-slate-400" />
                <label className={labelClass}>Start Date</label>
              </div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass + " mt-0"} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-slate-400" />
                <label className={labelClass}>End Date</label>
              </div>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass + " mt-0"} />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-6">
            <motion.button whileTap={{ scale: 0.96 }} onClick={handleSubmit} disabled={saving}
              className="w-full py-4 rounded-xl bg-rose-500 text-white font-bold text-lg hover:bg-rose-600 shadow-sm transition-colors flex justify-center items-center gap-2 disabled:opacity-60">
              {saving ? (
                <><Loader2 size={20} className="animate-spin" /> Saving...</>
              ) : (
                "Save Schedule"
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}