import { Link } from "react-router-dom";

export default function AuthTopBar() {
  return (
    <div className="fixed right-4 top-4 z-20 flex items-center gap-2">
      <Link
        to="/login"
        className="rounded-lg border border-slate-300/60 bg-white/70 px-3 py-2 text-xs text-slate-800 shadow hover:bg-white"
      >
        Login
      </Link>
      <Link
        to="/signup"
        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500"
      >
        Sign up
      </Link>
    </div>
  );
}
