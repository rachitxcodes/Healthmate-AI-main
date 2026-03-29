import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Activity, Brain, XCircle } from "lucide-react";
import { useDebounce } from "../hooks/use-debounce";

const COMMON_SYMPTOMS = [
  "Fever", "Headache", "Cough", "Fatigue", "Nausea",
  "Chest Pain", "Shortness of Breath", "Dizziness", "Sore Throat",
  "Body Aches", "Loss of Appetite", "Chills", "Weakness"
];

export default function SymptomDecoder() {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<{ disease: string; confidence: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const API_URL = (import.meta as any).env?.VITE_API_URL || "https://healthmate-api-2qu0.onrender.com";
  const debouncedQuery = useDebounce(searchQuery, 250);

  const addSymptom = (s: string) => {
    if (!selectedSymptoms.includes(s)) setSelectedSymptoms([...selectedSymptoms, s]);
  };
  const removeSymptom = (s: string) => setSelectedSymptoms(selectedSymptoms.filter(sym => sym !== s));

  const predictDiseases = async () => {
    if (selectedSymptoms.length === 0) return;
    setLoading(true);
    setPredictions([]);
    setErrorMsg(null);

    try {
      const resp = await fetch(`${API_URL}/predict?top_k=5`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: selectedSymptoms }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const parsed =
        data?.predictions?.map((p: any) => ({
          disease: p.class,
          confidence: Math.round((p.probability ?? 0) * 100),
        })) || [];
      setPredictions(parsed);
    } catch (err) {
      console.error("Prediction error:", err);
      setErrorMsg("Could not connect to the backend service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredSymptoms = COMMON_SYMPTOMS.filter(
    s => s.toLowerCase().includes(debouncedQuery.toLowerCase()) && !selectedSymptoms.includes(s)
  );

  return (
    <div className="w-full text-text-primary px-4 sm:px-6 pt-4 pb-24 max-w-[1100px] mx-auto animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="mb-10 mt-4 md:mt-8">
        <h1 className="text-3xl md:text-[2.5rem] font-bold tracking-tight text-slate-900 leading-tight mb-2">
          Symptom Decoder
        </h1>
        <p className="text-slate-500 font-semibold text-base md:text-lg">AI-powered diagnosis prediction based on your symptoms.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: Input */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="bg-white rounded-[2rem] p-8 sm:p-10 border border-rose-100 shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900">
              <Search size={22} className="text-slate-400" /> Select Symptoms
            </h2>

            {/* SEARCH INPUT */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Search for symptoms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400/20 focus:border-rose-400 transition-all font-medium placeholder:text-slate-400"
              />
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* SELECTED SYMPTOMS */}
            {selectedSymptoms.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="w-full text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Selected</span>
                {selectedSymptoms.map((s) => (
                  <div
                    key={s}
                    onClick={() => removeSymptom(s)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 text-white text-sm font-semibold cursor-pointer hover:bg-rose-500 transition-colors"
                  >
                    {s}
                    <XCircle size={14} className="opacity-70" />
                  </div>
                ))}
              </div>
            )}

            {/* COMMON SYMPTOMS */}
            <div className="mb-8">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Common Symptoms</span>
              <div className="flex flex-wrap gap-2">
                {filteredSymptoms.map((s) => (
                  <div
                    key={s}
                    onClick={() => addSymptom(s)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all text-sm shadow-sm"
                  >
                    {s}
                  </div>
                ))}
                {filteredSymptoms.length === 0 && (
                  <p className="text-sm text-slate-400 italic">No matching symptoms found.</p>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
              <button
                onClick={predictDiseases}
                disabled={selectedSymptoms.length === 0 || loading}
                className="flex-1 bg-rose-500 text-white font-bold py-3.5 rounded-xl hover:bg-rose-600 transition-colors shadow-[0_4px_15px_rgba(244,63,94,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Activity size={18} />
                {loading ? "Analyzing..." : "Predict Diseases"}
              </button>

              {selectedSymptoms.length > 0 && (
                <button
                  onClick={() => setSelectedSymptoms([])}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-slate-600 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* ERROR */}
            {errorMsg && (
              <div className="mt-6 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm font-semibold text-rose-700 flex items-center gap-2">
                <XCircle size={18} />
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Results — matches left card style */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-[2rem] p-8 sm:p-10 border border-rose-100 shadow-[0_8px_40px_rgba(0,0,0,0.04)] h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-bold text-xl tracking-tight text-slate-900">AI Differential Diagnosis</h3>
              <Brain size={24} className="text-slate-400" />
            </div>

            {/* Empty State */}
            {!loading && predictions.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                <Activity size={40} className="text-slate-300 mb-4" />
                <h4 className="text-lg font-bold text-slate-400 mb-2">Awaiting Symptoms</h4>
                <p className="text-slate-400 text-sm font-medium">Add your symptoms and click predict to see potential condition matches.</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex-1 flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 animate-pulse">
                    <div className="h-5 w-1/3 bg-slate-200 rounded-full mb-4" />
                    <div className="h-2 w-full bg-slate-100 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {!loading && predictions.length > 0 && (
              <div className="flex flex-col gap-4 flex-1">
                {predictions.map((p, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={p.disease}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-slate-900">{p.disease}</h4>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                        p.confidence > 70
                          ? "bg-emerald-50 text-emerald-600"
                          : p.confidence > 40
                          ? "bg-amber-50 text-amber-600"
                          : "bg-rose-50 text-rose-500"
                      }`}>
                        {p.confidence}% match
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${p.confidence}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className={`h-full rounded-full ${
                          p.confidence > 70
                            ? "bg-emerald-400"
                            : p.confidence > 40
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        }`}
                      />
                    </div>
                  </motion.div>
                ))}

                <div className="mt-auto pt-6">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 text-xs font-medium leading-relaxed">
                    <strong className="text-slate-500">Disclaimer:</strong> This tool is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}