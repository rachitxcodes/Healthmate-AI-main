import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Welcome from "./pages/Welcome";
import Signup from "./pages/Signup";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import RiskPredictor from "./pages/RiskPredictor";
import MedicineScheduler from "./pages/MedicineScheduler";
import SymptomDecoder from "./pages/SymptomDecoder";
import AiCompanion from "./pages/AiCompanion";
import ProfileSettings from "./pages/ProfileSettings";
import Vitals from "./pages/Vitals";
import ReportResult from "./pages/ReportResult";
import ReportHistoryDetails from "./pages/ReportHistoryDetails";
import ProtectedRoute from "./utils/ProtectedRoute";

// Helper to wrap private pages with Sidebar layout
function Private({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex w-full min-h-screen bg-surface font-sans selection:bg-rose-200 selection:text-slate-900">
        <Sidebar />
        <main className="flex-1 ml-24 lg:ml-32 min-h-screen overflow-y-auto">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <>
      {/* Public Navbar — only shown on public pages */}
      <Routes>
        <Route path="/" element={<><Navbar /><Welcome /></>} />
        <Route path="/signup" element={<><Navbar /><Signup /></>} />
        <Route path="/login" element={<><Navbar /><LoginPage /></>} />

        {/* Private Routes — all use NavbarPrivate */}
        <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
        <Route path="/risk-predictor" element={<Private><RiskPredictor /></Private>} />
        <Route path="/report-history/:id" element={<Private><ReportHistoryDetails /></Private>} />
        <Route path="/report-result" element={<Private><ReportResult /></Private>} />
        <Route path="/medicine-scheduler" element={<Private><MedicineScheduler /></Private>} />
        <Route path="/symptom-decoder" element={<Private><SymptomDecoder /></Private>} />
        <Route path="/ai-companion" element={<Private><AiCompanion /></Private>} />
        <Route path="/vitals" element={<Private><Vitals /></Private>} />
        <Route path="/settings" element={<Private><ProfileSettings /></Private>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}