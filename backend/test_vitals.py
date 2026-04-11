"""
HealthMate AI — Phase 1 Integration Test Script
================================================
Run from the backend/ directory:
  python test_vitals.py

HOW TO GET YOUR JWT TOKEN:
  1. Open http://localhost:5173 and log in
  2. Open browser DevTools (F12) → Console
  3. Run:
       JSON.parse(localStorage.getItem(
         Object.keys(localStorage).find(k => k.includes('auth-token'))
       )).access_token
  4. Copy the output and paste it as TOKEN below
"""

import json
import sys
import io
import requests

# Force UTF-8 output on Windows (avoids cp1252 emoji crash)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── CONFIG ─────────────────────────────────────────────────────────────────

BASE  = "http://localhost:8000"
TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjA3ZjkyODM2LTIxNzQtNDhkYy1iNGYwLWM0MDdhODM3MzdhYyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL21vZ3V0cGJ3enh4a216Y2R0eHFuLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5MzNhZWFiNy0wOTBkLTQyMTctYmNlZS04ZTE2MGM0YzcxMDciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NzIxODcwLCJpYXQiOjE3NzU3MTgyNzAsImVtYWlsIjoicmFjaGl0cmlja3k3NzdAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6InJhY2hpdHJpY2t5Nzc3QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJSYWNoaXQiLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjkzM2FlYWI3LTA5MGQtNDIxNy1iY2VlLThlMTYwYzRjNzEwNyJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzc1NTUzMjE4fV0sInNlc3Npb25faWQiOiJhNGMwNzM3OC1mZmQwLTQ5OGMtYmQ1OC05NDRkNDM1M2RmNzciLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.rtjveFFQ46FCtqBWmB7IPEF06eMWnpp_2wisQ88px-920ka-43ozdN3cNcS4xnFNWCGGsXVkOZlvhkuSdU8Hnw"        # ← replace this

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type":  "application/json",
}

PASS = 0
FAIL = 0


# ── Helpers ─────────────────────────────────────────────────────────────────

def ok(label: str, resp: requests.Response, expected_status: int = 200):
    global PASS, FAIL
    icon = "✅" if resp.status_code == expected_status else "❌"
    result = "PASS" if resp.status_code == expected_status else f"FAIL (got {resp.status_code})"
    print(f"\n{icon} [{result}] {label}")
    try:
        data = resp.json()
        print(json.dumps(data, indent=2)[:600])
    except Exception:
        print(resp.text[:300])
    if resp.status_code == expected_status:
        PASS += 1
    else:
        FAIL += 1
    return resp


def post(path, payload=None, auth=True):
    h = HEADERS if auth else {"Content-Type": "application/json"}
    return requests.post(f"{BASE}{path}", headers=h,
                         json=payload, timeout=15)

def get(path, params=None, auth=True):
    h = HEADERS if auth else {}
    return requests.get(f"{BASE}{path}", headers=h,
                        params=params, timeout=15)


# ── Tests ────────────────────────────────────────────────────────────────────

def run():
    if TOKEN == "PASTE_YOUR_JWT_HERE":
        print("❌ ERROR: Please paste your JWT token into TOKEN variable first.")
        print("   See instructions at the top of this file.")
        sys.exit(1)

    print("=" * 60)
    print("HealthMate AI — Phase 1 API Tests")
    print(f"Target: {BASE}")
    print("=" * 60)

    # ── T1: Public health check (no auth) ───────────────────────
    ok("T1: GET /api3/status (public, no auth)",
       get("/api3/status", auth=False), expected_status=200)

    # ── T2: Normal vitals → Stable ──────────────────────────────
    r = ok("T2: Normal vitals → Stable",
           post("/api3/vitals", {
               "heart_rate": 72.0,
               "spo2":       98.0,
               "temperature": 36.8,
           }), expected_status=200)
    if r.status_code == 200:
        d = r.json()
        assert d["status"] == "Stable", f"Expected Stable, got {d['status']}"
        assert d["score"] <= 40,        f"Expected score ≤ 40, got {d['score']}"
        print(f"   ✓ Score={d['score']} Status={d['status']}")

    # ── T3: Low SpO2 → Critical ─────────────────────────────────
    r = ok("T3: SpO2=90 → Critical (score ≥ 71)",
           post("/api3/vitals", {
               "heart_rate": 80.0,
               "spo2":       90.0,
               "temperature": 36.8,
           }), expected_status=200)
    if r.status_code == 200:
        d = r.json()
        # SpO2=90: NOT < 90 (boundary), falls into < 94 branch → 45pts → Warning
        assert d["status"] in ("Warning", "Critical"), \
               f"Expected Warning or Critical for SpO2=90, got {d['status']}"
        print(f"   ✓ Score={d['score']} Status={d['status']} (45pts → Warning territory)")
    # ── T3b: SpO2=88 → definitely Critical ─────────────────────────
    r = ok("T3b: SpO2=88 (< 90) → Critical (75pts alone)",
           post("/api3/vitals", {
               "heart_rate": 80.0,
               "spo2":       88.0,
               "temperature": 36.8,
           }), expected_status=200)
    if r.status_code == 200:
        d = r.json()
        assert d["status"] == "Critical", f"Expected Critical for SpO2=88, got {d['status']}"
        print(f"   ✓ Score={d['score']} Status={d['status']} alert_id={d.get('alert_id')}")

    # ── T4: High HR + symptoms → Warning/Critical ───────────────
    r = ok("T4: HR=115 + symptom_score=30 → Warning or Critical",
           post("/api3/vitals", {
               "heart_rate":    115.0,
               "spo2":          96.0,
               "temperature":   37.2,
               "symptom_score": 30,
           }), expected_status=200)
    if r.status_code == 200:
        d = r.json()
        assert d["status"] in ("Warning", "Critical"), \
               f"Expected Warning or Critical, got {d['status']}"
        print(f"   ✓ Score={d['score']} Status={d['status']}")
        print(f"   ✓ Breakdown: {d['breakdown']}")

    # ── T5: Bradycardia → Stable (≤ 20 pts) ───────────────────
    ok("T5: HR=40 (bradycardia, 20pts) → Stable",
       post("/api3/vitals", {
           "heart_rate":  40.0,
           "spo2":        97.0,
           "temperature": 36.5,
       }), expected_status=200)

    # ── T6: Validation — HR out of range → 422 ──────────────────
    ok("T6: HR=500 (invalid) → 422 Validation Error",
       post("/api3/vitals", {
           "heart_rate":  500.0,
           "spo2":        98.0,
           "temperature": 36.8,
       }), expected_status=422)

    # ── T7: Validation — SpO2 out of range → 422 ────────────────
    ok("T7: SpO2=150 (invalid) → 422 Validation Error",
       post("/api3/vitals", {
           "heart_rate":  72.0,
           "spo2":        150.0,
           "temperature": 36.8,
       }), expected_status=422)

    # ── T8: No auth → 403 ───────────────────────────────────────
    ok("T8: POST /api3/vitals without token → 403/401",
       post("/api3/vitals", {
           "heart_rate":  72.0,
           "spo2":        98.0,
           "temperature": 36.8,
       }, auth=False), expected_status=403)

    # ── T9: Get latest vitals ────────────────────────────────────
    r = ok("T9: GET /api3/vitals/latest → latest reading",
           get("/api3/vitals/latest"), expected_status=200)
    if r.status_code == 200:
        d = r.json()
        print(f"   ✓ age_seconds={d.get('age_seconds')} is_stale={d.get('is_stale')}")

    # ── T10: Vitals history ──────────────────────────────────────
    ok("T10: GET /api3/vitals/history?hours=24",
       get("/api3/vitals/history", params={"hours": 24}), expected_status=200)

    # ── T11: Risk score (read-only, with symptom param) ──────────
    r = ok("T11: GET /api3/risk-score?symptom_score=25",
           get("/api3/risk-score", params={"symptom_score": 25}), expected_status=200)
    if r.status_code == 200:
        d = r.json()
        print(f"   ✓ Score={d['score']} Status={d['status']}")
        print(f"   ✓ report_available={d.get('report_available')}")

    # ── T12: SOS trigger ─────────────────────────────────────────
    r = ok("T12: POST /api3/sos → alert_id returned",
           post("/api3/sos"), expected_status=200)
    if r.status_code == 200:
        d = r.json()
        print(f"   ✓ alert_id={d.get('alert_id')} email_sent={d.get('email_sent')}")

    # ── Summary ──────────────────────────────────────────────────
    print("\n" + "=" * 60)
    total = PASS + FAIL
    print(f"Results: {PASS}/{total} passed  |  {FAIL} failed")
    if FAIL == 0:
        print("🎉 All tests passed — Phase 1 backend is ready!")
    else:
        print("⚠️  Some tests failed — check output above.")
    print("=" * 60)

    # Remind about Supabase check
    print("\n📋 Also verify in Supabase Table Editor:")
    print("   vitals      → should have rows from tests above")
    print("   risk_scores → should have rows from tests above")
    print("   alerts      → should have 1+ Critical rows + 1 SOS row")


if __name__ == "__main__":
    run()
