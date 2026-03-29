import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "../supabaseClient";

type Message = {
  role: "user" | "ai";
  text: string;
};

const API_URL = import.meta.env.VITE_API_BASE_URL || "https://healthmate-api-2qu0.onrender.com";

export default function AiCompanion() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    loadHistory();
  }, []);

  const getAuthToken = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error("Not authenticated. Please log in again.");
    }
    return data.session.access_token;
  };

  const getReportContext = (): string | null => {
    try {
      const raw = sessionStorage.getItem("healthmate_report_result");
      if (!raw) return null;
      JSON.parse(raw);
      return raw;
    } catch {
      return null;
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api2/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      const loaded: Message[] = (data.messages || []).map(
        (m: { role: string; content: string }) => ({
          role: m.role === "assistant" ? "ai" : "user",
          text: m.content,
        })
      );
      setMessages(loaded);
    } catch (err) {
      console.warn("History load failed (non-fatal):", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const userMsg: Message = { role: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const reportContext = getReportContext();

      const response = await fetch(`${API_URL}/api2/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userText,
          report_context: reportContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error (${response.status})`);
      }

      const result = await response.json();
      setMessages((prev) => [...prev, { role: "ai", text: result.response }]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, I'm having trouble connecting right now. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const hasReportContext = !!getReportContext();

  return (
    <div className="w-full text-text-primary px-4 sm:px-6 pt-4 pb-12 max-w-[1000px] mx-auto animate-in fade-in duration-500 h-[100vh] flex flex-col">
      {/* HEADER */}
      <div className="mb-6 mt-4 md:mt-8 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-[2.5rem] font-bold tracking-tight text-slate-900 leading-tight mb-2">
            AI Companion
          </h1>
          <p className="text-slate-500 font-semibold text-base md:text-lg">Your personal health assistant, powered by medical context.</p>
        </div>
        {hasReportContext && (
          <div className="hidden md:flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-700 font-bold text-xs uppercase tracking-wider">Report Context Active</span>
          </div>
        )}
      </div>

      {/* CHAT CONTAINER */}
      <div className="flex-1 bg-gradient-to-br from-rose-50/80 to-pink-50/30 rounded-[2.5rem] border border-rose-100/60 shadow-[0_8px_30px_rgba(244,63,94,0.04)] flex flex-col overflow-hidden relative">

        {/* Decorative Top Highlight */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-300 via-rose-400 to-pink-400" />

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">

          {historyLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-rose-300">
              <div className="flex gap-1.5 mb-2">
                <span className="w-2.5 h-2.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2.5 h-2.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2.5 h-2.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-sm font-bold tracking-wide">Retrieving conversation...</p>
            </div>
          )}

          {!historyLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-20 h-20 rounded-[2rem] bg-white shadow-xl flex items-center justify-center border border-rose-100">
                <Bot size={40} className="text-rose-500" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-2">Hello! How can I help you today?</h3>
                <p className="text-slate-500 font-medium text-sm max-w-sm">Ask me about symptoms, your medical reports, or general wellness advice.</p>
              </div>
            </div>
          )}

          {!historyLoading && (
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-end gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "ai" && (
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-rose-100 flex items-center justify-center shrink-0">
                      <Bot size={20} className="text-rose-500" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] px-5 py-3.5 text-[15px] font-medium leading-relaxed font-sans ${m.role === "user"
                      ? "bg-slate-900 text-white rounded-[1.5rem] rounded-br-md shadow-[0_4px_15px_rgba(0,0,0,0.1)]"
                      : "bg-white text-slate-700 rounded-[1.5rem] rounded-bl-md border border-slate-200/60 shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
                      }`}
                  >
                    {m.text}
                  </div>

                  {m.role === "user" && (
                    <div className="w-10 h-10 rounded-2xl bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0">
                      <User size={18} className="text-slate-600" />
                    </div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-rose-100 flex items-center justify-center">
                    <Bot size={20} className="text-rose-500" />
                  </div>
                  <div className="bg-white border border-slate-200/60 shadow-[0_4px_15px_rgba(0,0,0,0.02)] px-5 py-4 rounded-[1.5rem] rounded-bl-md">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          <div ref={chatEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white/60 backdrop-blur-md border-t border-rose-100/50">
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mb-4 flex items-center gap-2 bg-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm font-bold shadow-sm">
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 bg-white border-2 border-slate-200 focus-within:border-rose-300 focus-within:shadow-[0_0_15px_rgba(244,63,94,0.1)] px-3 py-2.5 rounded-[1.5rem] transition-all">
            <div className="pl-2">
              <Sparkles size={20} className="text-rose-400" />
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Describe your symptoms or ask a medical question..."
              className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 font-medium px-2 py-1"
              disabled={historyLoading}
            />
            <button
              disabled={loading || !input.trim() || historyLoading}
              onClick={sendMessage}
              className="w-12 h-12 rounded-[1.25rem] bg-slate-900 hover:bg-rose-500 disabled:opacity-50 disabled:bg-slate-300 transition-colors flex items-center justify-center shrink-0 shadow-md"
            >
              <Send size={18} className="text-white ml-0.5" />
            </button>
          </div>
          <p className="text-center text-[11px] font-bold text-slate-400 mt-3 tracking-wide uppercase">AI can make mistakes. Consult a doctor for serious concerns.</p>
        </div>
      </div>
    </div>
  );
}