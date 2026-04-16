"""
vitals_api.py - Complete Vitals API for ESP32
Ready to use - just copy and paste
"""

import os
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests
from fastapi import APIRouter, HTTPException, Depends, Query, Header
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# ============================================================================
# CONFIG
# ============================================================================

SUPABASE_URL = f"https://{os.getenv('SUPABASE_PROJECT_ID')}.supabase.co"
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SVC_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "noreply@healthmate.ai")

supabase = create_client(SUPABASE_URL, SUPABASE_SVC_KEY)
router = APIRouter()

# ============================================================================
# AUTH - API KEY VALIDATION
# ============================================================================

def get_current_user_api_key(authorization: str = Header(None)) -> dict:
    """Validate API_KEY for ESP32 hardware (used for POST /vitals only)"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    try:
        parts = authorization.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid Authorization format")
        
        api_key = parts[1]
        expected_key = os.getenv("DEVICE_API_KEY", "")
        
        if not expected_key:
            print("⚠️ DEVICE_API_KEY not set in environment")
            raise HTTPException(status_code=500, detail="Backend not configured")
        
        if api_key != expected_key:
            print(f"❌ Invalid API key: {api_key[:15]}...")
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        hardware_user_id = os.getenv("HARDWARE_USER_ID", "550e8400-e29b-41d4-a716-446655440000")
        return {"id": hardware_user_id, "email": "hardware@device"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


def get_frontend_user(authorization: str = Header(None)) -> dict:
    """Accept any valid Bearer token from the browser (Supabase JWT).
    Always resolves to HARDWARE_USER_ID — one device, one user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    hardware_user_id = os.getenv("HARDWARE_USER_ID", "550e8400-e29b-41d4-a716-446655440000")
    return {"id": hardware_user_id}

# ============================================================================
# MODELS
# ============================================================================

class VitalsIn(BaseModel):
    heart_rate: float = Field(..., ge=40, le=200, description="BPM")
    spo2: float = Field(..., ge=70, le=100, description="Percent")
    temperature: float = Field(..., ge=10, le=43, description="Celsius")
    symptom_score: Optional[float] = Field(default=0, ge=0, le=100)
    steps: Optional[int] = Field(default=0, description="Step count")
    activity: Optional[str] = Field(default="stable", description="Current activity")
    fall_detected: Optional[bool] = Field(default=False)

# ============================================================================
# RISK CALCULATOR
# ============================================================================

def calculate_risk(hr, spo2, temp, report_risk, symptom_score_raw) -> dict:
    """Calculate unified risk score (0-100)"""
    
    spo2_pts = 0
    if spo2 is not None:
        if spo2 < 90:
            spo2_pts = 75
        elif spo2 < 94:
            spo2_pts = 45

    hr_pts = 0
    if hr is not None:
        if hr > 130:
            hr_pts = 45
        elif hr > 110:
            hr_pts = 30
        elif hr > 100:
            hr_pts = 20
        elif hr < 45:
            hr_pts = 30
        elif hr < 55:
            hr_pts = 15

    temp_pts = 0
    if temp is not None:
        if temp > 39.5:
            temp_pts = 30
        elif temp > 38.0:
            temp_pts = 15
        elif temp < 35.0:
            temp_pts = 20

    report_pts = 15 if (report_risk and report_risk > 0.60) else 0
    symptom_pts = min(30, int(symptom_score_raw / 2.5)) if symptom_score_raw else 0

    total_raw = spo2_pts + hr_pts + temp_pts + report_pts + symptom_pts
    final_score = min(100, total_raw)

    if final_score <= 40:
        status = "Stable"
    elif final_score <= 70:
        status = "Warning"
    else:
        status = "Critical"

    breakdown = {
        "spo2_points": spo2_pts,
        "hr_points": hr_pts,
        "temp_points": temp_pts,
        "report_points": report_pts,
        "symptom_points": symptom_pts,
    }
    
    return {"score": final_score, "status": status, "breakdown": breakdown}

# ============================================================================
# DATABASE HELPERS
# ============================================================================

def fetch_latest_report_risk(user_id: str):
    """Get latest report risk"""
    try:
        result = (
            supabase.table("reports")
            .select("report_data")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None

        report_data = result.data[0].get("report_data", {})
        predictions = report_data.get("predictions", {})
        
        max_risk = 0.0
        for disease, pred in predictions.items():
            if isinstance(pred, dict) and pred.get("ran"):
                prob = pred.get("risk_probability", 0)
                if isinstance(prob, (int, float)):
                    max_risk = max(max_risk, float(prob))
        
        return max_risk if max_risk > 0 else None
    except Exception as e:
        print(f"⚠️ fetch_latest_report_risk: {e}")
        return None

def fetch_previous_status(user_id: str):
    """Get previous risk status"""
    try:
        result = (
            supabase.table("risk_scores")
            .select("status")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["status"]
        return None
    except Exception as e:
        print(f"⚠️ fetch_previous_status: {e}")
        return None

def fetch_user_profile(user_id: str) -> dict:
    """Get user profile"""
    try:
        result = (
            supabase.table("profiles")
            .select("full_name, email, caregiver_email")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return result.data or {}
    except Exception:
        return {}

# ============================================================================
# EMAIL
# ============================================================================

def send_alert_email(to_emails: list, subject: str, body: str) -> bool:
    """Send email via SendGrid"""
    if not SENDGRID_API_KEY:
        print("⚠️ SENDGRID_API_KEY not set — email skipped")
        return False
    
    try:
        payload = {
            "personalizations": [{"to": [{"email": e} for e in to_emails]}],
            "from": {"email": SENDGRID_FROM_EMAIL, "name": "HealthMate AI"},
            "subject": subject,
            "content": [{"type": "text/plain", "value": body}],
        }
        resp = requests.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers={
                "Authorization": f"Bearer {SENDGRID_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        if resp.status_code in (200, 202):
            print(f"✅ Email sent to {to_emails}")
            return True
        print(f"⚠️ SendGrid {resp.status_code}")
        return False
    except Exception as e:
        print(f"❌ Email error: {e}")
        return False

# ============================================================================
# ALERT LOGIC
# ============================================================================

def maybe_send_critical_alert(user_id, score, status, previous_status, breakdown, vitals):
    """Create alert and send email if Critical"""
    
    if score < 71:
        return False, None

    profile = fetch_user_profile(user_id)
    full_name = profile.get("full_name", "User")
    patient_email = profile.get("email", "")
    caregiver_email = profile.get("caregiver_email", "")

    # Create alert row
    alert_id = None
    try:
        message = (
            f"Risk {score}/100 — {status}. "
            f"HR: {vitals.get('heart_rate')} BPM, "
            f"SpO2: {vitals.get('spo2')}%, "
            f"Temp: {vitals.get('temperature')}°C"
        )
        row = supabase.table("alerts").insert({
            "user_id": user_id,
            "type": "critical",
            "score": score,
            "message": message,
            "breakdown": breakdown,
            "seen": False,
        }).execute()
        if row.data:
            alert_id = row.data[0].get("id")
            print(f"🔔 Alert created: {alert_id}")
    except Exception as e:
        print(f"⚠️ Alert row failed: {e}")

    # Email only on state change
    if previous_status == "Critical":
        print("ℹ️ Already Critical — email suppressed")
        return False, alert_id

    to_emails = [e for e in [patient_email, caregiver_email] if e]
    if not to_emails:
        print("⚠️ No email addresses")
        return False, alert_id

    subject = f"🚨 HealthMate AI — Critical Alert for {full_name}"
    body = (
        f"Critical health alert!\n\n"
        f"Risk Score: {score}/100\n"
        f"Status: {status}\n\n"
        f"Vitals:\n"
        f"  HR: {vitals.get('heart_rate')} BPM\n"
        f"  SpO2: {vitals.get('spo2')}%\n"
        f"  Temp: {vitals.get('temperature')}°C\n\n"
        f"Please seek medical attention.\n"
        f"— HealthMate AI"
    )
    
    email_sent = send_alert_email(to_emails, subject, body)
    return email_sent, alert_id

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/vitals")
async def post_vitals(body: VitalsIn, user: dict = Depends(get_current_user_api_key)):
    """POST /api3/vitals - Receive vitals from ESP32"""
    
    user_id = user["id"]
    print(f"📡 Vitals: HR={body.heart_rate} SpO2={body.spo2} Temp={body.temperature}")

    # Save vitals
    try:
        # Try full insert first
        supabase.table("vitals").insert({
            "user_id": user_id,
            "heart_rate": body.heart_rate,
            "spo2": body.spo2,
            "temperature": body.temperature,
            "steps": body.steps,
            "activity": body.activity,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        print("✅ Vitals saved (Complete)")
    except Exception as e:
        error_msg = str(e).lower()
        # Fallback if ANY motion columns are missing
        if "column" in error_msg and ("steps" in error_msg or "activity" in error_msg):
            print("⚠️ DB missing motion columns. Saving basic vitals (Pulse/Temp/SpO2) only.")
            try:
                supabase.table("vitals").insert({
                    "user_id": user_id,
                    "heart_rate": body.heart_rate,
                    "spo2": body.spo2,
                    "temperature": body.temperature,
                    "recorded_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
                print("✅ Basic Vitals saved successfully")
            except Exception as e2:
                print(f"❌ Basic save failed: {e2}")
                raise HTTPException(status_code=500, detail="Database error")
        else:
            print(f"❌ Save failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to save")

    # Get report risk
    report_risk = fetch_latest_report_risk(user_id)

    # Calculate risk
    risk = calculate_risk(
        body.heart_rate,
        body.spo2,
        body.temperature,
        report_risk,
        body.symptom_score or 0,
    )

    score = risk["score"]
    status = risk["status"]
    breakdown = risk["breakdown"]
    print(f"📊 Risk: {score}/100 → {status}")

    # Get previous status
    previous_status = fetch_previous_status(user_id)

    # SPECIAL: Fall Detection Alert
    if body.fall_detected:
        print("🚨 FALL DETECTED! Sending emergency alert...")
        maybe_send_critical_alert(
            user_id, 100, "Critical", "Stable", 
            {"fall": "IMMEDIATE ACTION REQUIRED"}, 
            {"heart_rate": body.heart_rate, "spo2": body.spo2, "temperature": body.temperature}
        )

    # Save risk score
    try:
        supabase.table("risk_scores").insert({
            "user_id": user_id,
            "score": score,
            "status": status,
            "breakdown": breakdown,
        }).execute()
    except Exception as e:
        print(f"⚠️ Risk save failed: {e}")

    # Alert logic
    vitals_dict = {
        "heart_rate": body.heart_rate,
        "spo2": body.spo2,
        "temperature": body.temperature,
    }
    email_sent, alert_id = maybe_send_critical_alert(
        user_id, score, status, previous_status, breakdown, vitals_dict
    )

    return {
        "score": score,
        "status": status,
        "breakdown": breakdown,
        "alert_sent": email_sent,
        "alert_id": alert_id,
    }

@router.get("/vitals/latest")
async def get_latest_vitals(user: dict = Depends(get_frontend_user)):
    """GET /api3/vitals/latest - Supports 'Demo Mode' if DB is empty"""
    
    user_id = user["id"]
    try:
        # 1. Try to fetch real data
        result = None
        try:
            result = (
                supabase.table("vitals")
                .select("id, heart_rate, spo2, temperature, steps, activity, recorded_at")
                .eq("user_id", user_id)
                .order("recorded_at", desc=True)
                .limit(1)
                .execute()
            )
        except Exception:
            # Fallback for older DB schema (no steps/activity)
            result = (
                supabase.table("vitals")
                .select("id, heart_rate, spo2, temperature, recorded_at")
                .eq("user_id", user_id)
                .order("recorded_at", desc=True)
                .limit(1)
                .execute()
            )
        
        # 2. If data exists, return it
        if result and result.data:
            row = result.data[0]
            recorded_dt = datetime.fromisoformat(row["recorded_at"].replace("Z", "+00:00"))
            age_seconds = int((datetime.now(timezone.utc) - recorded_dt).total_seconds())

            return {
                "id": row["id"],
                "heart_rate": row["heart_rate"],
                "spo2": row["spo2"],
                "temperature": row["temperature"],
                "steps": row.get("steps", 0),
                "activity": row.get("activity", "stable"),
                "recorded_at": row["recorded_at"],
                "age_seconds": age_seconds,
                "is_stale": age_seconds > 300,
                "is_demo": False
            }

        # 3. DEMO MODE: If DB is empty, return high-quality fluctuating fake values
        print(f"ℹ️ User {user_id[:8]} has no vitals. Returning Smart Demo data.")
        
        # Use a time-based seed so latest and history match perfectly
        seed_time = int(datetime.now(timezone.utc).timestamp() / 5) * 5
        random.seed(seed_time)
        
        hr_jitter = random.uniform(-1.5, 1.5)
        spo2_jitter = random.uniform(-0.5, 0.5)
        temp_jitter = random.uniform(-0.1, 0.1)
        
        # Reset seed for other potential random calls
        random.seed()
        
        return {
            "id": "demo-mode",
            "heart_rate": round(72.0 + hr_jitter, 1),
            "spo2": round(98.5 + spo2_jitter, 1),
            "temperature": round(36.6 + temp_jitter, 1),
            "steps": 1042 + (seed_time % 100),
            "activity": "Stable (Demo)",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "age_seconds": 0,
            "is_stale": False,
            "is_demo": True
        }

    except Exception as e:
        print(f"❌ Error in get_latest_vitals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vitals/history")
async def get_vitals_history(
    hours: int = Query(default=24, ge=1, le=168),
    user: dict = Depends(get_frontend_user),
):
    """GET /api3/vitals/history?hours=24"""
    
    user_id = user["id"]
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

        result = (
            supabase.table("vitals")
            .select("heart_rate, spo2, temperature, recorded_at")
            .eq("user_id", user_id)
            .gte("recorded_at", since)
            .order("recorded_at", desc=False)
            .execute()
        )
        
        # If no real data, generate a synthetic history trend for the graphs
        if not result.data:
            print(f"ℹ️ Generating synthetic history for {user_id[:8]}")
            demo_readings = []
            base_hr = 72.0
            base_spo2 = 98.2
            base_temp = 36.6
            
            # Generate 50 points (last few hours)
            now = datetime.now(timezone.utc)
            for i in range(50):
                # Random walk logic for realistic trends
                base_hr += random.uniform(-2, 2)
                base_hr = max(60, min(100, base_hr))
                
                base_spo2 += random.uniform(-0.2, 0.2)
                base_spo2 = max(95, min(100, base_spo2))
                
                base_temp += random.uniform(-0.05, 0.05)
                base_temp = max(36.2, min(37.2, base_temp))
                
                demo_readings.append({
                    "heart_rate": round(base_hr, 1),
                    "spo2": round(base_spo2, 1),
                    "temperature": round(base_temp, 1),
                    "recorded_at": (now - timedelta(minutes=5 * (50 - i))).isoformat()
                })
            
            return {
                "readings": demo_readings,
                "count": len(demo_readings),
                "hours": hours,
                "is_demo": True
            }

        return {
            "readings": result.data,
            "count": len(result.data),
            "hours": hours,
            "is_demo": False
        }
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/risk-score")
async def get_risk_score(
    symptom_score: Optional[float] = Query(default=0, ge=0, le=100),
    user: dict = Depends(get_frontend_user),
):
    """GET /api3/risk-score"""
    
    user_id = user["id"]

    vitals_result = (
        supabase.table("vitals")
        .select("heart_rate, spo2, temperature")
        .eq("user_id", user_id)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
    
    # If DB is empty, use the same base simulated values we use in get_latest_vitals
    if not vitals_result.data:
        hr_demo = 72.0 + random.uniform(-1.5, 1.5)
        spo2_demo = 98.5 + random.uniform(-0.5, 0.5)
        temp_demo = 36.6 + random.uniform(-0.1, 0.1)
        latest_vitals = {
            "heart_rate": round(hr_demo, 1),
            "spo2": round(spo2_demo, 1),
            "temperature": round(temp_demo, 1)
        }
        # Synthetic breakdown for a high "Safety Score" (target ~94-98)
        base_safety = 96
        hr_var = random.randint(-1, 1)
        spo2_var = random.randint(-1, 1)
        
        demo_breakdown = {
            "Heart Stability": 98 + hr_var,
            "Oxygen Level": 99 + spo2_var,
            "Temperature": 100,
            "Consistency": 97
        }
        # Final safety score is the average or just a stable high number
        demo_score = 96 + hr_var + spo2_var
        
        return {
            "score": demo_score,
            "status": "Stable",
            "breakdown": demo_breakdown,
            "report_available": False,
            "latest_vitals": latest_vitals,
            "is_demo": True
        }
    else:
        latest_vitals = vitals_result.data[0]
        report_risk = fetch_latest_report_risk(user_id)
        
        risk = calculate_risk(
            latest_vitals["heart_rate"],
            latest_vitals["spo2"],
            latest_vitals["temperature"],
            report_risk,
            symptom_score or 0
        )

        return {
            **risk,
            "report_available": report_risk is not None,
            "latest_vitals": latest_vitals,
            "is_demo": False
        }

@router.post("/sos")
async def trigger_sos(user: dict = Depends(get_frontend_user)):
    """POST /api3/sos - Emergency SOS"""
    
    user_id = user["id"]
    print(f"🆘 SOS triggered")

    vitals_result = (
        supabase.table("vitals")
        .select("heart_rate, spo2, temperature")
        .eq("user_id", user_id)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
    latest_vitals = vitals_result.data[0] if vitals_result.data else {}

    profile = fetch_user_profile(user_id)
    full_name = profile.get("full_name", "User")
    patient_email = profile.get("email", "")
    caregiver_email = profile.get("caregiver_email", "")

    sos_breakdown = {
        "triggered_by": "SOS_BUTTON",
        "final_score": 100,
    }

    try:
        row = supabase.table("alerts").insert({
            "user_id": user_id,
            "type": "sos",
            "score": 100,
            "message": f"🆘 SOS from {full_name}",
            "breakdown": sos_breakdown,
            "seen": False,
        }).execute()
        alert_id = row.data[0].get("id") if row.data else None
    except Exception as e:
        print(f"⚠️ SOS alert failed: {e}")
        alert_id = None

    to_emails = [e for e in [patient_email, caregiver_email] if e]
    email_sent = False
    if to_emails:
        subject = f"🆘 EMERGENCY SOS — {full_name}"
        body = f"Emergency SOS from {full_name}. Last vitals: HR={latest_vitals.get('heart_rate')}, SpO2={latest_vitals.get('spo2')}%. Check immediately!"
        email_sent = send_alert_email(to_emails, subject, body)

    return {
        "alert_id": alert_id,
        "email_sent": email_sent,
        "score": 100,
        "status": "Critical",
    }

@router.get("/status")
async def api_status():
    """GET /api3/status - Health check (no auth required)"""
    return {
        "status": "ok",
        "service": "vitals-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }