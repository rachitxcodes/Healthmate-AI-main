import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, Bell, User, Phone, Calendar, LogOut, Save } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function ProfileSettings() {
  const { user, signOut, loading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");

  const [notifications, setNotifications] = useState(true);
  const [emailReminder, setEmailReminder] = useState(false);
  const [medicineReminder, setMedicineReminder] = useState(true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone, date_of_birth")
        .eq("id", user.id)
        .single();
      if (!error && data) {
        setName(data.full_name || "");
        setEmail(data.email || user.email || "");
        setPhone(data.phone || "");
        setDob(data.date_of_birth || "");
      }
    };
    fetchProfile();
  }, [user]);

  if (loading) return null;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, phone: phone || null, date_of_birth: dob || null })
      .eq("id", user.id);

    if (error) {
      setMessage("❌ Failed to update profile");
    } else {
      setMessage("✅ Profile updated successfully");
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/";
  };

  const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 transition-all font-medium placeholder:text-slate-400";
  const labelClass = "block text-sm font-bold text-slate-700 mb-1.5 ml-1";

  return (
    <div className="w-full text-text-primary px-4 sm:px-6 pt-4 pb-24 max-w-[1100px] mx-auto animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="mb-8 mt-4 md:mt-8">
        <h1 className="text-3xl md:text-[2.5rem] font-bold tracking-tight text-slate-900 leading-tight mb-2">
          Profile Settings
        </h1>
        <p className="text-slate-500 font-semibold text-base md:text-lg">Manage your personal information and preferences.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: Profile Info */}
        <div className="lg:col-span-8 flex flex-col gap-8">

          {/* USER HEADER CARD */}
          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-center gap-8">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative group shrink-0">
              <div className="w-28 h-28 rounded-[2rem] bg-slate-900 shadow-lg border border-slate-800 flex items-center justify-center text-4xl font-black text-white">
                {name ? name[0].toUpperCase() : "U"}
              </div>
              <button className="absolute -bottom-3 -right-3 bg-white border border-slate-200 text-slate-700 p-2.5 rounded-full shadow-md hover:bg-slate-50 transition-colors">
                <Camera size={18} />
              </button>
            </motion.div>
            <div className="text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{name || "User"}</h2>
              <p className="text-slate-500 font-semibold">{email}</p>
            </div>
          </div>

          {/* ACCOUNT INFO FORM */}
          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User size={20} className="text-slate-400" /> Account Information
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Jane Doe" />
              </div>
              <div>
                <label className={labelClass}>Email Address</label>
                <input type="email" value={email} disabled className={`${inputClass} bg-slate-50 text-slate-500 cursor-not-allowed`} />
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} pl-11`} placeholder="+1 (555) 000-0000" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Date of Birth</label>
                <div className="relative">
                  <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={`${inputClass} pl-11`} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-4 border-t border-slate-100 pt-6">
              <button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md shadow-black/10 flex items-center gap-2">
                <Save size={18} /> {saving ? "Saving..." : "Save Changes"}
              </button>
              {message && <span className="text-sm font-semibold text-slate-600">{message}</span>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Preferences */}
        <div className="lg:col-span-4 flex flex-col gap-8">

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 text-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] h-full flex flex-col">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Bell size={20} className="text-slate-400" /> Preferences
            </h3>

            <div className="flex flex-col gap-6">
              <ToggleRow label="Push Notifications" desc="Updates on your device" enabled={notifications} setEnabled={setNotifications} />
              <div className="h-px bg-white/10 w-full" />
              <ToggleRow label="Email Reminders" desc="Weekly health summaries" enabled={emailReminder} setEnabled={setEmailReminder} />
              <div className="h-px bg-white/10 w-full" />
              <ToggleRow label="Medicine Alerts" desc="Keep track of your schedule" enabled={medicineReminder} setEnabled={setMedicineReminder} />
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-auto">
            <button onClick={handleLogout} className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors border border-rose-100">
              <LogOut size={18} strokeWidth={2.5} />
              Sign Out Securely
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom Toggle Component
interface ToggleRowProps {
  label: string;
  desc: string;
  enabled: boolean;
  setEnabled: (val: boolean) => void;
}

function ToggleRow({ label, desc, enabled, setEnabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between group cursor-pointer" onClick={() => setEnabled(!enabled)}>
      <div>
        <h4 className="font-bold text-slate-100 mb-0.5 group-hover:text-white transition-colors">{label}</h4>
        <p className="text-[13px] text-slate-400 font-medium leading-tight">{desc}</p>
      </div>
      <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${enabled ? "bg-emerald-500" : "bg-slate-700"}`}>
        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${enabled ? "translate-x-6" : "translate-x-0"}`} />
      </div>
    </div>
  );
}
