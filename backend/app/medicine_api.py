# medicine_api.py — Medicine CRUD + Streak/Adherence tracking

import os
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = f"https://{os.getenv('SUPABASE_PROJECT_ID')}.supabase.co"
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter()
security = HTTPBearer()


# ── Auth ──────────────────────────────────────────────────────────────────────
def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=10,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        user_data = response.json()
        user_id = user_data.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not extract user ID.")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed.")


# ── Pydantic Models ───────────────────────────────────────────────────────────
class MedicineCreate(BaseModel):
    medicine_name: str
    dosage: str
    doses_per_day: int = 1
    times: list[str]
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    frequency: str = "daily"
    every_hours: Optional[int] = None


class MedicineTake(BaseModel):
    scheduled_time: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/medicines")
async def list_medicines(user_id: str = Depends(get_current_user_id)):
    """Fetch all active medicines for this user."""
    try:
        result = (
            supabase.table("medicines")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .order("created_at", desc=True)
            .execute()
        )
        return {"medicines": result.data or []}
    except Exception as e:
        print(f"❌ list_medicines error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/medicines")
async def create_medicine(body: MedicineCreate, user_id: str = Depends(get_current_user_id)):
    """Create a new medicine schedule."""
    try:
        row = {
            "user_id": user_id,
            "medicine_name": body.medicine_name.strip(),
            "dosage": body.dosage.strip(),
            "doses_per_day": body.doses_per_day,
            "times": body.times,
            "start_date": body.start_date,
            "end_date": body.end_date,
            "frequency": body.frequency,
            "every_hours": body.every_hours,
            "is_active": True,
        }
        result = supabase.table("medicines").insert(row).execute()
        return {"medicine": result.data[0] if result.data else row}
    except Exception as e:
        print(f"❌ create_medicine error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str, user_id: str = Depends(get_current_user_id)):
    """Soft-delete a medicine (set is_active=false)."""
    try:
        supabase.table("medicines") \
            .update({"is_active": False}) \
            .eq("id", medicine_id) \
            .eq("user_id", user_id) \
            .execute()
        return {"status": "deleted"}
    except Exception as e:
        print(f"❌ delete_medicine error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/medicines/{medicine_id}/take")
async def take_medicine(
    medicine_id: str,
    body: MedicineTake,
    user_id: str = Depends(get_current_user_id),
):
    """Log that a dose was taken."""
    try:
        supabase.table("medicine_logs").insert({
            "medicine_id": medicine_id,
            "user_id": user_id,
            "scheduled_time": body.scheduled_time,
        }).execute()
        return {"status": "logged"}
    except Exception as e:
        print(f"❌ take_medicine error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/medicines/stats")
async def medicine_stats(user_id: str = Depends(get_current_user_id)):
    """
    Calculate adherence stats:
    - streak: consecutive days with at least 1 logged dose
    - today_taken / today_total: doses taken vs expected today
    """
    try:
        # Get active medicines
        meds = (
            supabase.table("medicines")
            .select("id, times, doses_per_day")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        active_meds = meds.data or []
        today_total = sum(len(m.get("times", [])) for m in active_meds)

        # Get today's logs
        today_str = date.today().isoformat()
        logs = (
            supabase.table("medicine_logs")
            .select("id, taken_at")
            .eq("user_id", user_id)
            .gte("taken_at", f"{today_str}T00:00:00")
            .lte("taken_at", f"{today_str}T23:59:59")
            .execute()
        )
        today_taken = len(logs.data or [])

        # ── Calculate streak: Fetch all logs for the past year in ONE query ────────────────
        search_start = (date.today() - timedelta(days=365)).isoformat()
        all_logs_res = (
            supabase.table("medicine_logs")
            .select("taken_at")
            .eq("user_id", user_id)
            .gte("taken_at", f"{search_start}T00:00:00")
            .execute()
        )
        
        # Convert to a set of unique dates for O(1) lookup
        logged_dates = {datetime.fromisoformat(log["taken_at"]).date() for log in (all_logs_res.data or [])}
        
        streak = 0
        check_date = date.today()
        
        # If no dose today, the streak might still be active from yesterday
        if check_date not in logged_dates:
            check_date -= timedelta(days=1)
            
        while check_date in logged_dates:
            streak += 1
            check_date -= timedelta(days=1)

        return {
            "streak": streak,
            "today_taken": today_taken,
            "today_total": today_total,
            "adherence_percent": round((today_taken / today_total * 100) if today_total > 0 else 0),
        }
    except Exception as e:
        print(f"❌ medicine_stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
