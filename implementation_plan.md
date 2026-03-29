# HealthMate AI — Integration Plan

> [!NOTE]
> This plan covers 4 integration phases. Each phase is independent so we can ship incrementally and test as we go.

---

## User Review Required

> [!IMPORTANT]
> **Supabase SQL**: Phases 1 and 3 require creating/altering Supabase tables. I'll provide the SQL — you must run it in the Supabase SQL Editor before we test.

> [!WARNING]
> **[.env](file:///c:/Users/Rachit%20Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/backend/.env) secrets** are committed in [backend/.env](file:///c:/Users/Rachit%20Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/backend/.env). Consider using Render env vars + [.gitignore](file:///c:/Users/Rachit%20Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/.gitignore) instead of committing keys. This is not blocking but worth addressing.

---

## Phase 1: Medicine Scheduler → Supabase

### Supabase SQL (user must run)

```sql
-- medicines table
CREATE TABLE IF NOT EXISTS medicines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  doses_per_day INTEGER DEFAULT 1,
  times TEXT[] NOT NULL,
  start_date DATE,
  end_date DATE,
  frequency TEXT DEFAULT 'daily',
  every_hours INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- medicine_logs table (for streak/adherence tracking)
CREATE TABLE IF NOT EXISTS medicine_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  taken_at TIMESTAMPTZ DEFAULT now(),
  scheduled_time TEXT NOT NULL
);

-- RLS policies
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own medicines"
  ON medicines FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own medicine logs"
  ON medicine_logs FOR ALL USING (auth.uid() = user_id);
```

### Backend

#### [NEW] [medicine_api.py](file:///c:/Users/Rachit Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/backend/app/medicine_api.py)

New FastAPI router with JWT-authenticated endpoints:

- `GET /api/medicines` — Fetch all active medicines for user
- `POST /api/medicines` — Create a new medicine schedule
- `DELETE /api/medicines/{id}` — Soft-delete (set `is_active=false`)
- `POST /api/medicines/{id}/take` — Log a dose taken (for streak tracking)
- `GET /api/medicines/stats` — Return adherence stats (streak count, doses taken vs expected today)

Uses the existing `supabase` service-role client from [ai_companion_api.py](file:///c:/Users/Rachit%20Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/backend/app/ai_companion_api.py) pattern. Auth via the same `HTTPBearer` + Supabase user verification.

#### [MODIFY] [main.py](file:///c:/Users/Rachit Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/backend/app/main.py)

- Register the new medicine router: `app.include_router(medicine_router, prefix="/api")`

### Frontend

#### [MODIFY] [MedicineScheduler.tsx](file:///c:/Users/Rachit Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/frontend/src/pages/MedicineScheduler.tsx)

- Replace `localStorage` save with `POST /api/medicines` API call
- Add `useEffect` to fetch saved medicines from `GET /api/medicines` on load
- Display list of saved medicines with delete button
- Add "Mark as Taken" button per medicine → `POST /api/medicines/{id}/take`
- Calculate streak from `GET /api/medicines/stats` instead of hardcoded `3`

---

## Phase 2: Dashboard → Live Data

### Frontend

#### [MODIFY] [Dashboard.tsx](file:///c:/Users/Rachit Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/frontend/src/pages/Dashboard.tsx)

**Stat Cards** — Replace hardcoded values with live data:
- **Overall Health**: Compute from latest report's disease risks (avg risk → "Good"/"Fair"/"At Risk")
- **Recent Reports**: Count from `reports` table
- **Health Insights**: Count of disease risks that were flagged
- **Medication Adherence**: From `GET /api/medicines/stats`

**Recent Reports Table** — Replace 2 hardcoded rows:
- Fetch from [getReportHistory()](file:///c:/Users/Rachit%20Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/frontend/src/utils/reportHistory.ts#13-44) (already exists in [reportHistory.ts](file:///c:/Users/Rachit%20Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/frontend/src/utils/reportHistory.ts))
- Show report name, analyzed status, and formatted date
- Link each row to `/report-history/:id`

**Upcoming Medicines** — Replace localStorage fetch:
- Fetch from `GET /api/medicines` instead
- Filter to today's schedule based on times

**Health Trends Chart** — Wire to real data:
- Fetch last 7 reports from Supabase
- Extract key values (glucose, cholesterol, etc.) per report date
- Render SVG paths from actual data points

**AI Companion Panel** — Connect to real chat:
- Fetch most recent AI chat message from `/api2/history`
- Display as preview; keep existing link to full AI Companion page

---

## Phase 3: Profile Settings → Full Read/Write

### Supabase SQL (user must run)

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;
```

### Frontend

#### [MODIFY] [ProfileSettings.tsx](file:///c:/Users/Rachit Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/frontend/src/pages/ProfileSettings.tsx)

- **Read**: Expand `select` to include `phone, date_of_birth`; populate state on load
- **Save**: Update Supabase `profiles` row with `full_name, phone, date_of_birth`
- **Notification preferences**: Save to `localStorage` for now (no backend table needed — this is UI-only state)

---

## Phase 4: AI Doctor → Better Report Context

### Backend

#### [MODIFY] [ai_companion_api.py](file:///c:/Users/Rachit Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/backend/app/ai_companion_api.py)

Current [fetch_latest_report()](file:///c:/Users/Rachit%20Dubey/Documents/Codehub/Projects/Healthmate_AI/HealthMate-AI-main/backend/app/ai_companion_api.py#169-212) only gets the latest 1 report. Improvements:

- Fetch up to 3 most recent reports (with report type label)
- Inject each report's key findings as a dated summary
- Add medicine schedule context: fetch active medicines from `medicines` table and include in system prompt
- This gives the AI doctor awareness of both medical history and current medication

---

## Verification Plan

### Manual Testing (User)

Since this app relies on Supabase auth and live API connections, the most effective verification is manual browser testing:

1. **Run Supabase SQL** — Execute the migration SQL from Phases 1 and 3 in Supabase SQL Editor
2. **Start backend** — `cd backend && uvicorn app.main:app --reload`
3. **Start frontend** — `cd frontend && npm run dev`
4. **Log in** and test each feature:

| Feature | How to Test |
|---------|------------|
| Medicine Scheduler | Go to /medicine-scheduler, add a medicine, verify it appears in saved list. Refresh page — it should persist. |
| Medicine Delete | Click delete on a saved medicine, verify it disappears. |
| Mark as Taken | Click "Take" on a medicine, verify streak updates. |
| Dashboard Stats | Go to /dashboard. Verify stat cards show real numbers matching your reports/medicines. |
| Dashboard Reports | Verify "Recent Reports" table shows your actual Supabase reports with correct names/dates. |
| Dashboard Medicines | Verify "Upcoming Medicines" shows medicines from Supabase, not localStorage. |
| Profile Settings | Go to /settings. Add phone and DOB. Save. Refresh — values should persist. |
| AI Doctor Context | Open AI Companion, ask "What do my reports say?" — should reference actual report values. |
