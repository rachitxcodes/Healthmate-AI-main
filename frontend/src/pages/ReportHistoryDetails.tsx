import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getReportById, ReportRecord } from "../utils/reportHistory";
import GlassCard from "../components/GlassCard";
import PrimaryButton from "../components/PrimaryButton";
import { ArrowLeft, Clock, FileText, Activity, TrendingUp } from "lucide-react";
import { supabase } from "../supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://healthmate-api-2qu0.onrender.com";

function riskColor(pct: string) {
  const v = parseFloat(pct);
  if (v >= 60) return { text: "text-red-500", bar: "bg-red-500", badge: "bg-red-50 text-red-600", label: "High Risk" };
  if (v >= 30) return { text: "text-amber-500", bar: "bg-amber-400", badge: "bg-amber-50 text-amber-600", label: "Moderate Risk" };
  return { text: "text-emerald-500", bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-600", label: "Low Risk" };
}

function formatDiseaseName(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function detectReportType(extractedData: Record<string, any>) {
  const keys = Object.keys(extractedData).map(k => k.toLowerCase());
  const hasBlood = keys.some(k => ["hgb", "hemoglobin", "rbc", "wbc", "pcv", "hematocrit", "mch", "mchc", "mcv", "platelet", "tlc"].some(m => k.includes(m)));
  const hasDiabetes = keys.some(k => ["glucose", "insulin", "hba1c"].some(m => k.includes(m)));
  const hasHeart = keys.some(k => ["cholesterol", "chol", "troponin", "thalach", "trestbps"].some(m => k.includes(m)));
  const hasLiver = keys.some(k => ["bilirubin", "albumin", "sgpt", "sgot", "alt", "ast", "alp", "alkaline"].some(m => k.includes(m)));

  if (hasLiver) return { label: "Liver Function Report", color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-t-orange-400" };
  if (hasHeart) return { label: "Cardiac Report", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-t-red-400" };
  if (hasDiabetes) return { label: "Diabetes Report", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-t-blue-400" };
  if (hasBlood) return { label: "Blood Count Report", color: "text-rose-600", bgColor: "bg-rose-50", borderColor: "border-t-rose-400" };
  return { label: "Medical Report", color: "text-slate-600", bgColor: "bg-slate-50", borderColor: "border-t-slate-400" };
}

export default function ReportHistoryDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [explanations, setExplanations] = useState<Record<string, { explanation: string; precautions: string[] }>>({});
  const [overallSummary, setOverallSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingExplanations, setLoadingExplanations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchReport() {
      if (!id) return;
      const data = await getReportById(id);
      if (data) {
        setReport(data);
        setExplanations(data.explanations || {});
        setOverallSummary(data.summary || "");
      }
      setLoading(false);
    }
    fetchReport();
  }, [id]);

  useEffect(() => {
    if (!report || !id) return;

    const ran = Object.fromEntries(
      Object.entries(report.predictions || {}).filter(([_, v]: any) => v?.ran === true)
    );
    const totalDiseases = Object.keys(ran).length;
    if (totalDiseases === 0) return;

    async function fillMissingData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const currentExplanations = { ...explanations };
      let updatedAny = false;

      // 1. Fetch missing explanations
      for (const disease of Object.keys(ran)) {
        const prediction = ran[disease];
        if (!currentExplanations[disease]) {
          setLoadingExplanations(prev => ({ ...prev, [disease]: true }));
          try {
            const res = await fetch(`${API_BASE_URL}/api1/explain`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({
                disease,
                risk_percent: prediction.risk_percent,
                matched_features: prediction.matched_features,
                extracted_data: report.extractedData,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              currentExplanations[disease] = {
                explanation: data.explanation || "",
                precautions: data.precautions || []
              };
              setExplanations({ ...currentExplanations });
              updatedAny = true;
            }
          } catch (e) {
            console.warn(`Failed to explain ${disease} on the fly:`, e);
          } finally {
            setLoadingExplanations(prev => ({ ...prev, [disease]: false }));
          }
        }
      }

      // 2. Fetch missing summary if all explanations are ready
      let finalSummary = overallSummary;
      if (Object.keys(currentExplanations).length === totalDiseases && !finalSummary) {
        setLoadingSummary(true);
        try {
          const sumRes = await fetch(`${API_BASE_URL}/api1/summarize-report`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              predictions: ran,
              explanations: currentExplanations,
              extracted_data: report.extractedData
            })
          });
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            finalSummary = sumData.summary || "";
            setOverallSummary(finalSummary);
            updatedAny = true;
          }
        } catch (e) {
          console.warn("Failed to summarize report on the fly:", e);
        } finally {
          setLoadingSummary(false);
        }
      }

      // 3. Save to database if we generated anything new
      if (updatedAny) {
        try {
          const { data: existing } = await supabase
            .from("reports")
            .select("report_data")
            .eq("id", id)
            .single();

          if (existing) {
            await supabase
              .from("reports")
              .update({
                report_data: {
                  ...existing.report_data,
                  explanations: currentExplanations,
                  summary: finalSummary
                }
              })
              .eq("id", id);
            console.log("✅ On-the-fly explanations and summary saved to Supabase");
          }
        } catch (e) {
          console.warn("Failed to persist on-the-fly details:", e);
        }
      }
    }

    fillMissingData();
  }, [report, id]);

  if (loading) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-rose-200 border-t-rose-500" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-6 text-center">
        <GlassCard className="max-w-md w-full !p-10 flex flex-col items-center">
          <div className="bg-slate-100 text-slate-400 p-4 rounded-full mb-6">
            <FileText size={48} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Report Not Found</h2>
          <p className="text-slate-500 mb-8">This report might have been deleted or never existed.</p>
          <PrimaryButton onClick={() => navigate("/risk-predictor")} className="w-full">
            Back to Risk Predictor
          </PrimaryButton>
        </GlassCard>
      </div>
    );
  }

  const ranPredictions = Object.entries(report.predictions || {}).filter(
    ([_, v]: any) => v?.ran === true
  );

  const reportType = detectReportType(report.extractedData);

  return (
    <div className="w-full text-text-primary min-h-[calc(100vh-80px)]">
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-32">

        {/* BACK BUTTON */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button
            onClick={() => navigate("/risk-predictor")}
            className="flex items-center gap-2 text-slate-500 hover:text-rose-600 font-bold bg-white/50 hover:bg-white px-4 py-2 rounded-xl transition-all shadow-sm border border-slate-200/50"
          >
            <ArrowLeft size={18} />
            Back to Reports
          </button>
        </motion.div>

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${reportType.bgColor} ${reportType.color} inline-block mb-3`}>
            {reportType.label}
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
            {report.name || "Medical Report"}
          </h1>
          <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
            <Clock size={14} />
            {new Date(report.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </motion.div>

        {/* EQUAL TWO COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT: DISEASE RISK + EXPLANATIONS */}
          <div className="flex flex-col gap-6">
            {ranPredictions.length > 0 ? (
              <GlassCard className={`!p-8 border-t-8 ${reportType.borderColor}`}>
                <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
                  <div className={`${reportType.bgColor} ${reportType.color} p-2.5 rounded-xl`}>
                    <TrendingUp size={22} />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Disease Risk Analysis</h2>
                </div>

                <div className="flex flex-col gap-6">
                  {ranPredictions.map(([disease, pred]: any) => {
                    const risk = riskColor(pred.risk_percent);
                    const exp = explanations[disease];
                    return (
                      <motion.div
                        key={disease}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 rounded-2xl bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-black text-slate-900 text-lg">{formatDiseaseName(disease)}</h3>
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${risk.badge}`}>
                            {risk.label}
                          </span>
                        </div>
                        <div className="flex items-end justify-between mb-3">
                          <p className={`text-4xl font-black tracking-tight ${risk.text}`}>
                            {pred.risk_percent}
                          </p>
                          <p className="text-xs text-slate-400 font-semibold">
                            {pred.matched_features?.length || 0} parameters matched
                          </p>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: pred.risk_percent }}
                            transition={{ duration: 0.8 }}
                            className={`h-full rounded-full ${risk.bar}`}
                          />
                        </div>
                        {pred.matched_features?.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {pred.matched_features.map((f: string) => (
                              <span key={f} className="text-[11px] font-bold px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* EXPLANATION / loading state */}
                        {loadingExplanations[disease] ? (
                          <div className="mt-6 pt-6 border-t border-slate-200/80 space-y-4">
                            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200 shadow-sm animate-pulse space-y-3">
                              <div className="h-4 bg-slate-200 rounded w-1/3" />
                              <div className="h-3 bg-slate-100 rounded w-full" />
                              <div className="h-3 bg-slate-100 rounded w-5/6" />
                            </div>
                          </div>
                        ) : (
                          exp?.explanation && (
                            <div className="mt-6 pt-6 border-t border-slate-200/80 space-y-6">
                              <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2.5 mb-3">
                                  <div className="bg-rose-50 p-2 rounded-lg text-rose-500 border border-rose-100/50"><span className="text-sm">💡</span></div>
                                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">What This Means For You</h4>
                                </div>
                                <p className="text-slate-600 text-[14px] leading-relaxed font-medium">{exp.explanation}</p>
                              </div>

                              {exp.precautions && exp.precautions.length > 0 && (
                                <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200 shadow-sm">
                                  <div className="flex items-center gap-2.5 mb-4">
                                    <div className="bg-emerald-50 p-2 rounded-lg text-emerald-500 border border-emerald-100/50"><span className="text-sm">🛡️</span></div>
                                    <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Recommended Actions</h4>
                                  </div>
                                  <ul className="space-y-2.5">
                                    {exp.precautions.map((p: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-3 text-[14px] font-medium text-slate-600 leading-relaxed p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="shrink-0 w-6 h-6 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold border border-emerald-200/50">{idx + 1}</span>
                                        <span className="mt-0.5">{p}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="!p-8 border-t-8 border-t-slate-200 text-center">
                <Activity size={40} className="text-slate-300 mx-auto mb-4" />
                <h3 className="font-black text-slate-500 mb-2">No Predictions Available</h3>
                <p className="text-slate-400 text-sm">Not enough data was matched to run disease models.</p>
              </GlassCard>
            )}

            {/* OVERALL AI REPORT SUMMARY CARD */}
            {(overallSummary || loadingSummary) && (
              <GlassCard className="!p-8 border-t-8 border-t-rose-500 shadow-rose-500/5 overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-rose-50 p-2.5 rounded-xl text-rose-500 shadow-sm border border-rose-100/50"><span className="text-xl">📊</span></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">Overall AI Health Summary</h3>
                </div>
                {loadingSummary ? (
                  <div className="space-y-3 mt-4 animate-pulse">
                    <div className="h-3 bg-slate-200/60 rounded-full w-full" />
                    <div className="h-3 bg-slate-200/60 rounded-full w-5/6" />
                  </div>
                ) : (
                  <p className="text-slate-600 text-[16px] leading-relaxed font-medium">
                    {overallSummary}
                  </p>
                )}
              </GlassCard>
            )}
          </div>

          {/* RIGHT: EXTRACTED LAB VALUES */}
          <div className="h-full">
            <GlassCard className="!p-8 border-t-8 border-t-slate-800 h-full">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 text-slate-600 p-2.5 rounded-xl">
                    <FileText size={22} />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Extracted Lab Values</h2>
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                  {Object.keys(report.extractedData).length} values
                </span>
              </div>

              {Object.keys(report.extractedData).length === 0 ? (
                <p className="text-slate-400 text-sm font-medium text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No lab values extracted for this report.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 overflow-y-auto max-h-[65vh] pr-1">
                  {Object.entries(report.extractedData).map(([key, value]) => (
                    <div key={key} className="flex flex-col border-b border-slate-100 pb-4">
                      <span className="text-slate-400 text-[10px] font-bold mb-1 tracking-wider uppercase">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-900 font-mono font-semibold text-sm">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

        </div>
      </main>
    </div>
  );
}