import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabaseClient";
import { useNavigate, Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import PrimaryButton from "../components/PrimaryButton";
import { UploadCloud, CheckCircle2, AlertCircle, Edit3, Trash2, FileText, ChevronRight } from "lucide-react";
import { getReportHistory, deleteReportById, ReportRecord } from "../utils/reportHistory";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://healthmate-api-2qu0.onrender.com";

export default function RiskPredictor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [appState, setAppState] = useState<"upload" | "scanning" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<Record<string, string | number>>({});
  const [fullApiResult, setFullApiResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pastReports, setPastReports] = useState<ReportRecord[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const history = await getReportHistory();
    setPastReports(history);
  };

  const handleHistoryDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteReportById(id);
    loadHistory();
  };

  const openFileDialog = () => {
    if (appState === "upload") inputRef.current?.click();
  };

  const resetMessages = () => setErrorMsg("");
  const acceptMime = "image/*";

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFilePick = async (f: File | null | undefined) => {
    if (!f || appState !== "upload") return;
    resetMessages();
    setFile(f);
    if (f.type.startsWith("image/")) {
      const b64 = await fileToBase64(f);
      setPreview(b64);
    } else {
      setPreview(null);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFilePick(e.target.files?.[0]);
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); handleFilePick(e.dataTransfer.files?.[0]); };

  const handleUploadAndExtract = async () => {
    resetMessages();
    if (!file) {
      setErrorMsg("Please select an image first.");
      return;
    }

    setAppState("scanning");
    setProgress(15);

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) throw new Error("Not logged in");

      const formData = new FormData();
      formData.append("file", file);

      setProgress(40);

      const response = await fetch(`${API_BASE_URL}/upload-image/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      setProgress(85);

      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Upload failed");

      setFullApiResult(result);
      const outputData = result.extracted_data || {};
      setExtractedData(outputData);
      setProgress(100);

      // Store file name for later use when saving to Supabase
      sessionStorage.setItem("healthmate_report_filename", file.name);

      setTimeout(() => {
        setAppState("review");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 600);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Something went wrong during extraction.");
      setAppState("upload");
      setProgress(0);
    }
  };

  const handleConfirmAndAnalyze = () => {
    if (!fullApiResult) return;
    setIsAnalyzing(true);

    const updatedResult = {
      ...fullApiResult,
      extracted_data: extractedData,
      name: file?.name || "Medical Report",
    };

    sessionStorage.setItem("healthmate_report_result", JSON.stringify(updatedResult));
    setTimeout(() => {
      navigate("/report-result", { state: { triggerAnalysis: true } });
    }, 400);
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const staggerItem: any = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="w-full text-text-primary min-h-[calc(100vh-80px)]">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-32 flex flex-col items-center">

        <AnimatePresence mode="popLayout">
          {appState === "upload" && (
            <motion.div
              key="header-upload"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
              transition={{ duration: 0.4 }}
              className="text-center mb-10 mt-4 md:mt-10"
            >
              <h1 className="text-4xl sm:text-[2.75rem] font-black tracking-tight mb-4 text-slate-900">Upload Medical Report</h1>
              <p className="text-slate-500 font-semibold text-lg max-w-2xl mx-auto">Securely upload your lab result. We'll extract the parameters and predict potential risks for you.</p>
            </motion.div>
          )}

          {appState === "review" && (
            <motion.div
              key="header-review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center mb-10 w-full"
            >
              <h1 className="text-4xl sm:text-[2.75rem] font-black tracking-tight mb-4 text-slate-900">Review Extraction</h1>
              <p className="text-slate-500 font-semibold text-lg max-w-2xl mx-auto">
                We've isolated the medical parameters from your report. Adjust any values if needed before the AI begins its analysis.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`w-full transition-all duration-700 ease-in-out flex ${appState === "review" ? "flex-col lg:flex-row gap-8 lg:items-start" : "justify-center"}`}>

          {/* UPLOAD / IMAGE PREVIEW CONTAINER */}
          <motion.div
            layout="position"
            className={`transition-all duration-700 ease-in-out w-full ${appState === "review" ? "lg:w-[40%] sticky top-28" : "max-w-4xl"}`}
          >
            <GlassCard className={`relative overflow-hidden transition-all duration-500 ${appState !== "review" ? "!p-6 sm:!p-10 border-t-8 border-t-rose-400" : "!p-6"}`}>
              <motion.div
                layout
                animate={appState === "scanning" ? { scale: [1, 1.01, 1], boxShadow: ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 40px rgba(244, 63, 94, 0.12)", "0px 0px 0px rgba(0,0,0,0)"] } : {}}
                transition={{ repeat: appState === "scanning" ? Infinity : 0, duration: 2, ease: "easeInOut" }}
                onClick={appState === "upload" ? openFileDialog : undefined}
                onDragOver={appState === "upload" ? onDragOver : undefined}
                onDragLeave={appState === "upload" ? onDragLeave : undefined}
                onDrop={appState === "upload" ? onDrop : undefined}
                className={`
                  relative rounded-[2rem] text-center transition-all overflow-hidden
                  ${appState === "upload" && !preview ? "cursor-pointer border-2 border-dashed p-10 sm:p-20 border-rose-200/60 bg-gradient-to-br from-rose-50/40 to-white hover:from-rose-100/50 hover:to-rose-50/40 hover:border-rose-300 shadow-[inset_0_2px_10px_rgba(244,63,94,0.02)]" : ""}
                  ${appState === "upload" && preview ? "cursor-pointer border border-slate-200 bg-slate-50 p-2 sm:p-4" : ""}
                  ${appState === "upload" && dragActive ? "border-rose-400 bg-rose-50/50 scale-[1.02]" : ""}
                  ${appState === "scanning" ? "border-2 border-rose-300 bg-rose-50/30 p-2 sm:p-4 shadow-inner" : ""}
                  ${appState === "review" ? "border border-slate-200 bg-slate-50" : ""}
                `}
              >
                {/* SCANNING OVERLAY EFFECT */}
                <AnimatePresence>
                  {appState === "scanning" && (
                    <motion.div
                      initial={{ top: "-10%" }}
                      animate={{ top: "110%" }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="absolute left-0 right-0 h-40 bg-gradient-to-b from-transparent via-rose-400/20 to-rose-400/60 border-b-2 border-rose-500 z-50 pointer-events-none mix-blend-overlay"
                    />
                  )}
                </AnimatePresence>

                {appState !== "review" && (
                  <motion.div layout className="flex flex-col items-center justify-center relative z-10 w-full">
                    {!preview ? (
                      <>
                        <div className={`mx-auto mb-6 h-20 w-20 rounded-full flex items-center justify-center transition-colors ${appState === "scanning" ? "bg-rose-100 text-rose-500" : "bg-rose-50 text-rose-400"}`}>
                          {appState === "scanning" ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                              <UploadCloud size={36} />
                            </motion.div>
                          ) : (
                            <UploadCloud size={36} />
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                          {appState === "scanning" ? "Scanning & Extracting Parameters..." : "Click or drag your report here"}
                        </h3>
                        <p className="text-slate-500 font-medium">{appState === "upload" ? "Supports JPG, PNG (Max 10MB)" : "Our AI is reading your document"}</p>
                      </>
                    ) : (
                      <div className="w-full relative rounded-2xl overflow-hidden shadow-sm bg-slate-100/50 border border-slate-200 backdrop-blur-sm flex items-center justify-center">
                        {(appState === "upload") && (
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                            <span className="text-white font-bold bg-black/50 px-5 py-2.5 rounded-full backdrop-blur-md shadow-lg">Change File</span>
                          </div>
                        )}
                        <img src={preview} alt="report preview" className={`w-full object-contain transition-all duration-700 ${appState === "scanning" ? "h-[500px] sm:h-[650px] opacity-80" : "h-[500px] sm:h-[650px]"}`} />
                      </div>
                    )}
                  </motion.div>
                )}

                {appState === "review" && preview && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="relative bg-white rounded-2xl border border-slate-100">
                    <img src={preview} alt="report preview" className="w-full h-auto object-contain rounded-2xl max-h-[65vh]" />
                  </motion.div>
                )}
              </motion.div>

              {!preview && appState === "upload" && <input ref={inputRef} type="file" accept={acceptMime} className="hidden" onChange={onChange} />}

              <AnimatePresence>
                {appState === "scanning" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-8 overflow-hidden max-w-2xl mx-auto px-4">
                    <div className="flex justify-between items-center mb-3 text-sm font-bold text-slate-600">
                      <span>Extracting OCR Data...</span>
                      <span className="text-rose-600">{progress}%</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner border border-slate-200">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: "tween", ease: "easeOut", duration: 0.4 }}
                        className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {errorMsg && (
                  <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-6 flex items-center gap-3 text-status-critical font-bold bg-rose-50 border border-status-critical/20 p-4 rounded-xl max-w-2xl mx-auto">
                    <AlertCircle size={20} className="shrink-0" />
                    <span className="text-sm">{errorMsg}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {appState === "upload" && file && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-8 max-w-xl mx-auto">
                    <PrimaryButton onClick={handleUploadAndExtract} className="w-full py-4 text-[17px] shadow-lg shadow-rose-500/20">
                      Extract Parameters →
                    </PrimaryButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          </motion.div>

          {/* EXTRACTION FORM RIGHT COLUMN */}
          <AnimatePresence>
            {appState === "review" && (
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
                className="w-full lg:w-[60%]"
              >
                <GlassCard className="!p-8 sm:!p-10 border-t-8 border-t-slate-800">
                  <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
                    <div className="bg-rose-100 text-rose-600 p-2.5 rounded-xl"><Edit3 size={24} /></div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Extracted Values</h2>
                  </div>

                  {Object.keys(extractedData).length === 0 ? (
                    <p className="text-slate-500 font-medium py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No values extracted. Please go back and try uploading a clearer image.
                    </p>
                  ) : (
                    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-7">
                      {Object.entries(extractedData).map(([key, value]) => (
                        <motion.div variants={staggerItem} key={key} className="flex flex-col group">
                          <span className="text-slate-500 text-[11px] font-bold mb-1.5 tracking-wider uppercase pl-1 group-focus-within:text-rose-500 transition-colors">{key.replace(/_/g, ' ')}</span>
                          <input
                            value={String(value)}
                            onChange={(e) => setExtractedData({ ...extractedData, [key]: e.target.value })}
                            className="bg-white rounded-xl px-4 py-3 font-mono text-slate-900 text-[15px] w-full border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100 transition-all"
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-end">
                    <button
                      onClick={() => { setAppState("upload"); setFile(null); setPreview(null); }}
                      className="text-slate-500 font-bold hover:text-slate-900 transition-colors px-6 py-3"
                    >
                      Re-upload image
                    </button>

                    <PrimaryButton
                      onClick={handleConfirmAndAnalyze}
                      disabled={isAnalyzing || Object.keys(extractedData).length === 0}
                      className="w-full sm:w-auto px-10 py-4 text-lg shadow-xl shadow-slate-900/10"
                    >
                      {isAnalyzing ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Analyzing Risk...
                        </span>
                      ) : "Confirm & Run AI Analysis"}
                    </PrimaryButton>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SCAN HISTORY */}
        <AnimatePresence>
          {appState === "upload" && pastReports.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full max-w-5xl mt-24"
            >
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Your Scan History</h2>
                  <p className="text-slate-500 font-medium">All your reports saved securely in your account.</p>
                </div>
                <div className="bg-rose-50 text-rose-500 rounded-full w-12 h-12 flex items-center justify-center border border-rose-100 shadow-sm">
                  <FileText size={24} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastReports.map((report) => (
                  <Link to={`/report-history/${report.id}`} key={report.id} className="group outline-none">
                    <GlassCard className="!p-0 h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_rgba(244,63,94,0.1)] group-focus-visible:ring-4 group-focus-visible:ring-rose-200">
                      <div className="h-40 w-full overflow-hidden relative border-b border-slate-100">
                        {report.imageSrc ? (
                          <img src={report.imageSrc} alt={report.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <div className={`w-full h-full flex flex-col items-center justify-center gap-2 transition-colors ${
                            (() => {
                              const keys = Object.keys(report.extractedData || {}).map(k => k.toLowerCase());
                              const hasBlood = keys.some(k => ["hgb","hemoglobin","rbc","wbc","pcv","platelet"].some(m => k.includes(m)));
                              const hasLiver = keys.some(k => ["bilirubin","albumin","sgpt","sgot","alt","ast"].some(m => k.includes(m)));
                              const hasDiabetes = keys.some(k => ["glucose","insulin"].some(m => k.includes(m)));
                              if (hasLiver) return "bg-orange-50";
                              if (hasDiabetes) return "bg-blue-50";
                              if (hasBlood) return "bg-rose-50";
                              return "bg-slate-50";
                            })()
                          }`}>
                            <FileText size={36} className={`${
                              (() => {
                                const keys = Object.keys(report.extractedData || {}).map(k => k.toLowerCase());
                                const hasBlood = keys.some(k => ["hgb","hemoglobin","rbc","wbc","pcv","platelet"].some(m => k.includes(m)));
                                const hasLiver = keys.some(k => ["bilirubin","albumin","sgpt","sgot","alt","ast"].some(m => k.includes(m)));
                                const hasDiabetes = keys.some(k => ["glucose","insulin"].some(m => k.includes(m)));
                                if (hasLiver) return "text-orange-300";
                                if (hasDiabetes) return "text-blue-300";
                                if (hasBlood) return "text-rose-300";
                                return "text-slate-300";
                              })()
                            }`} />
                            <span className="text-xs font-bold text-slate-400">
                              {(() => {
                                const keys = Object.keys(report.extractedData || {}).map(k => k.toLowerCase());
                                const hasBlood = keys.some(k => ["hgb","hemoglobin","rbc","wbc","pcv","platelet"].some(m => k.includes(m)));
                                const hasLiver = keys.some(k => ["bilirubin","albumin","sgpt","sgot","alt","ast"].some(m => k.includes(m)));
                                const hasDiabetes = keys.some(k => ["glucose","insulin"].some(m => k.includes(m)));
                                if (hasLiver) return "Liver Report";
                                if (hasDiabetes) return "Diabetes Report";
                                if (hasBlood) return "Blood Report";
                                return "Medical Report";
                              })()}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <button
                            onClick={(e) => handleHistoryDelete(report.id, e)}
                            className="bg-white/90 backdrop-blur-sm p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 shadow-sm transition-all border border-slate-200/50"
                            title="Delete this record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="p-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                          {new Date(report.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <h3 className="font-bold text-slate-900 text-lg truncate mb-3 pr-4">{report.name || "Medical Report"}</h3>

                        {/* Show risk summary if available */}
                        {report.predictions && Object.entries(report.predictions).some(([_, v]: any) => v?.ran) && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {Object.entries(report.predictions)
                              .filter(([_, v]: any) => v?.ran)
                              .map(([disease, pred]: any) => {
                                const pct = parseFloat(pred.risk_percent);
                                const color = pct >= 60 ? "bg-red-50 text-red-500" : pct >= 30 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600";
                                return (
                                  <span key={disease} className={`text-[10px] font-bold px-2 py-1 rounded-full ${color}`}>
                                    {disease.charAt(0).toUpperCase() + disease.slice(1)} {pred.risk_percent}
                                  </span>
                                );
                              })}
                          </div>
                        )}

                        <div className="flex items-center text-sm font-bold text-rose-500 group-hover:text-rose-600">
                          <span>View Details</span>
                          <ChevronRight size={18} className="translate-x-0 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}