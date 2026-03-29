import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, User } from "lucide-react";

type Message = {
  role: "user" | "ai";
  text: string;
};

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "Hi there! I'm your HealthMate AI companion. You can ask me to explain any terms from your report or general health questions." }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleChat = () => setOpen((prev) => !prev);

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/api3/support-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "The server responded with an error.");
      }

      const result = await response.json();

      const aiMessage: Message = { role: "ai", text: result.response };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (err) {
      const errorMessage: Message = {
        role: "ai",
        text: "I'm having trouble connecting right now. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={toggleChat}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-primary text-white shadow-floating hover:bg-primary-hover transition-colors flex items-center justify-center transform origin-center"
        style={{ minHeight: '60px', minWidth: '60px' }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={28} />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Bot size={28} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-24 right-6 z-40 w-full max-w-[380px] h-[550px] max-h-[80vh] rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-2xl shadow-floating flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-white/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light/40 flex items-center justify-center text-primary">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary leading-tight">AI Doctor</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
                    <span className="text-xs font-semibold text-text-secondary">Online</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setMessages([])} className="text-xs font-bold text-text-secondary hover:text-primary transition bg-slate-100 hover:bg-primary-light/30 px-3 py-1.5 rounded-full">
                Clear
              </button>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-surface/50 scroll-smooth">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "ai" && (
                    <div className="w-8 h-8 rounded-full bg-primary-light/40 flex-shrink-0 flex items-center justify-center text-primary mb-1">
                      <Bot size={14} />
                    </div>
                  )}

                  <div className={`max-w-[75%] px-5 py-3.5 text-sm leading-relaxed font-medium shadow-sm ${m.role === "user"
                      ? "bg-slate-800 text-white rounded-3xl rounded-br-sm"
                      : "bg-white text-text-primary rounded-3xl rounded-bl-sm border border-slate-100"
                    }`}
                  >
                    {m.text}
                  </div>

                  {m.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-500 mb-1">
                      <User size={14} />
                    </div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary-light/40 flex-shrink-0 flex items-center justify-center text-primary mb-1">
                    <Bot size={14} />
                  </div>
                  <div className="bg-white px-5 py-4 rounded-3xl rounded-bl-sm border border-slate-100 shadow-sm flex items-center gap-1.5">
                    <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 rounded-full bg-primary"></motion.span>
                    <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 rounded-full bg-primary"></motion.span>
                    <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 rounded-full bg-primary"></motion.span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 bg-white border-t border-slate-100">
              {messages.length === 1 && (
                <div className="flex gap-2 overflow-x-auto pb-3 mb-1 no-scrollbar">
                  <button onClick={() => setInput("What is a lipid panel?")} className="shrink-0 bg-primary-light/20 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-colors px-4 py-1.5 rounded-full text-xs font-bold">
                    What is a lipid panel?
                  </button>
                  <button onClick={() => setInput("Is high cholesterol dangerous?")} className="shrink-0 bg-primary-light/20 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-colors px-4 py-1.5 rounded-full text-xs font-bold">
                    Is high cholesterol dangerous?
                  </button>
                </div>
              )}

              <div className="flex gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 shadow-inner">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="flex-1 px-4 py-3 bg-transparent text-text-primary text-sm font-medium outline-none placeholder-text-secondary/60"
                  placeholder="Ask a medical question..."
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="w-12 h-12 flex items-center justify-center shrink-0 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed my-auto mr-1"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}