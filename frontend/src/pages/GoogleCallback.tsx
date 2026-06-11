import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "../supabaseClient";

const API_URL = import.meta.env.VITE_API_BASE_URL || "https://healthmate-api-2qu0.onrender.com";

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const getAuthToken = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Not authenticated");
    return data.session.access_token;
  };

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      setErrorMsg("No authorization code found in URL redirect.");
      return;
    }

    exchangeCode(code);
  }, [searchParams]);

  const exchangeCode = async (code: string) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/google/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as any;
        throw new Error(errorData.detail || "Failed to link Google Calendar.");
      }

      setStatus("success");
      // Redirect to medicine scheduler after a brief delay
      setTimeout(() => {
        navigate("/medicine-scheduler");
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setErrorMsg(message);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-slate-800">
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.04)] max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="h-16 w-16 text-rose-500 animate-spin mx-auto" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Connecting Google Calendar...</h1>
            <p className="text-slate-500 font-medium">Please wait while we establish a secure connection with your Google Account.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Successfully Connected!</h1>
            <p className="text-slate-500 font-medium">Your Google Calendar is now linked. We are redirecting you back to your medicine scheduler...</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-rose-500 mx-auto" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Connection Failed</h1>
            <p className="text-rose-500 font-semibold text-sm bg-rose-50 p-4 rounded-2xl border border-rose-100">{errorMsg}</p>
            <button
              onClick={() => navigate("/medicine-scheduler")}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
            >
              Back to Scheduler
            </button>
          </>
        )}
      </div>
    </div>
  );
}
