# medicine_api.py — Medicine CRUD + Streak/Adherence tracking + Google Calendar Integration

import os
import base64
import uuid
import requests
from datetime import datetime, date, timedelta, timezone as pytimezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
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
    timezone: Optional[str] = "UTC"


class MedicineTake(BaseModel):
    scheduled_time: str


class GoogleCallbackBody(BaseModel):
    code: str


# ── Google OAuth & Calendar Helpers ──────────────────────────────────────────
def get_valid_google_token(user_id: str) -> Optional[str]:
    try:
        res = supabase.table("user_google_tokens").select("*").eq("user_id", user_id).execute()
        if not res.data:
            return None
        
        token_data = res.data[0]
        access_token = token_data["access_token"]
        refresh_token = token_data["refresh_token"]
        expires_at_str = token_data["expires_at"]
        
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        now = datetime.now(expires_at.tzinfo)
        
        if expires_at <= now + timedelta(seconds=60):
            print(f"🔄 Google Access Token expired for user {user_id[:8]}. Refreshing...")
            client_id = os.getenv("GOOGLE_CLIENT_ID")
            client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
            
            payload = {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
            
            resp = requests.post("https://oauth2.googleapis.com/token", json=payload, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                new_access_token = data["access_token"]
                expires_in = data.get("expires_in", 3600)
                new_expiry = (datetime.now(pytimezone.utc) + timedelta(seconds=expires_in)).isoformat()
                
                supabase.table("user_google_tokens").update({
                    "access_token": new_access_token,
                    "expires_at": new_expiry
                }).eq("user_id", user_id).execute()
                
                return new_access_token
            else:
                print(f"❌ Failed to refresh Google Token: {resp.status_code} - {resp.text}")
                return None
        return access_token
    except Exception as e:
        print(f"⚠️ Error get_valid_google_token: {e}")
        return None


def sync_medicine_to_google_calendar(medicine: dict, timezone_name: str = "UTC") -> list[str]:
    user_id = medicine["user_id"]
    access_token = get_valid_google_token(user_id)
    if not access_token:
        print(f"ℹ️ Google Calendar not connected for user {user_id[:8]}, skipping sync.")
        return []
        
    medicine_name = medicine["medicine_name"]
    dosage = medicine["dosage"]
    times = medicine["times"]
    frequency = medicine["frequency"]
    every_hours = medicine.get("every_hours")
    start_date = medicine.get("start_date") or date.today().isoformat()
    end_date = medicine.get("end_date")
    
    rrule = ""
    if frequency == "daily":
        rrule = "FREQ=DAILY"
    elif frequency == "alternate":
        rrule = "FREQ=DAILY;INTERVAL=2"
    elif frequency == "every_x_hours" and every_hours:
        rrule = f"FREQ=HOURLY;INTERVAL={every_hours}"
        
    if end_date and rrule:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        end_dt = end_dt.replace(hour=23, minute=59, second=59)
        rrule += f";UNTIL={end_dt.strftime('%Y%m%dT%H%M%SZ')}"
        
    event_ids = []
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    for t in times:
        try:
            hour, minute = map(int, t.split(":"))
        except Exception:
            hour, minute = 9, 0
            
        start_datetime_str = f"{start_date}T{hour:02d}:{minute:02d}:00"
        
        end_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = end_dt.replace(hour=hour, minute=minute) + timedelta(minutes=15)
        end_datetime_str = end_dt.strftime("%Y-%m-%dT%H:%M:%S")
        
        event_body = {
            "summary": f"💊 Take {medicine_name} ({dosage})",
            "description": f"Medicine reminder from HealthMate AI.\nDosage: {dosage}\nFrequency: {frequency}",
            "start": {
                "dateTime": start_datetime_str,
                "timeZone": timezone_name
            },
            "end": {
                "dateTime": end_datetime_str,
                "timeZone": timezone_name
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {
                        "method": "popup",
                        "minutes": 0
                    }
                ]
            }
        }
        
        if rrule:
            event_body["recurrence"] = [f"RRULE:{rrule}"]
            
        try:
            resp = requests.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                json=event_body,
                headers=headers,
                timeout=10
            )
            if resp.status_code in (200, 201):
                event_data = resp.json()
                event_ids.append(event_data["id"])
                print(f"✅ Created calendar event: {event_data['id']} for {medicine_name} at {t}")
            else:
                print(f"⚠️ Failed to create Google Calendar event: {resp.status_code} - {resp.text}")
        except Exception as ex:
            print(f"❌ Error creating Google Calendar event: {ex}")
            
    return event_ids


def delete_google_calendar_events(user_id: str, event_ids: list[str]):
    if not event_ids:
        return
        
    access_token = get_valid_google_token(user_id)
    if not access_token:
        print(f"ℹ️ Google Calendar not connected for user {user_id[:8]}, skipping event deletion.")
        return
        
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    for event_id in event_ids:
        try:
            resp = requests.delete(
                f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
                headers=headers,
                timeout=10
            )
            if resp.status_code in (200, 204):
                print(f"✅ Deleted Google Calendar event: {event_id}")
            elif resp.status_code == 404:
                print(f"ℹ️ Google Calendar event already deleted: {event_id}")
            else:
                print(f"⚠️ Failed to delete Google Calendar event {event_id}: {resp.status_code} - {resp.text}")
        except Exception as ex:
            print(f"❌ Error deleting Google Calendar event {event_id}: {ex}")


# ── Google OAuth Endpoints ───────────────────────────────────────────────────
@router.get("/google/auth-url")
async def get_google_auth_url(user_id: str = Depends(get_current_user_id)):
    """Generate the Google authorization URL to redirect users to."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth not configured on backend.")
        
    scopes = "https://www.googleapis.com/auth/calendar.events"
    
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scopes}&"
        "access_type=offline&"
        "prompt=consent"
    )
    return {"url": auth_url}


@router.post("/google/callback")
async def google_callback(body: GoogleCallbackBody, user_id: str = Depends(get_current_user_id)):
    """Exchange OAuth code for access and refresh tokens, and save to Supabase."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth not configured on backend.")
        
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": body.code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri
    }
    
    try:
        resp = requests.post("https://oauth2.googleapis.com/token", json=payload, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Token exchange failed: {resp.status_code} - {resp.text}")
            raise HTTPException(status_code=400, detail=f"Token exchange failed: {resp.text}")
            
        data = resp.json()
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        expires_in = data.get("expires_in", 3600)
        
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token returned from Google.")
            
        expires_at = (datetime.now(pytimezone.utc) + timedelta(seconds=expires_in)).isoformat()
        
        row = {
            "user_id": user_id,
            "access_token": access_token,
            "expires_at": expires_at
        }
        if refresh_token:
            row["refresh_token"] = refresh_token
            
        check = supabase.table("user_google_tokens").select("user_id, refresh_token").eq("user_id", user_id).execute()
        if check.data:
            if "refresh_token" not in row:
                row["refresh_token"] = check.data[0]["refresh_token"]
            supabase.table("user_google_tokens").update(row).eq("user_id", user_id).execute()
        else:
            if "refresh_token" not in row:
                raise HTTPException(status_code=400, detail="Did not receive refresh_token. Please disconnect and try again.")
            supabase.table("user_google_tokens").insert(row).execute()
            
        return {"status": "connected"}
    except Exception as e:
        print(f"❌ Google callback error: {e}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/google/status")
async def get_google_status(user_id: str = Depends(get_current_user_id)):
    """Check if the current user has connected their Google Calendar."""
    try:
        res = supabase.table("user_google_tokens").select("user_id").eq("user_id", user_id).execute()
        return {"connected": len(res.data) > 0}
    except Exception as e:
        print(f"⚠️ get_google_status error: {e}")
        return {"connected": False}


@router.post("/google/disconnect")
async def google_disconnect(user_id: str = Depends(get_current_user_id)):
    """Disconnect Google Calendar by deleting user tokens."""
    try:
        supabase.table("user_google_tokens").delete().eq("user_id", user_id).execute()
        return {"status": "disconnected"}
    except Exception as e:
        print(f"❌ google_disconnect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/google/sync")
async def sync_all_medicines(timezone: str = "UTC", user_id: str = Depends(get_current_user_id)):
    """Sync all unsynced active medicines for the current user to Google Calendar."""
    try:
        access_token = get_valid_google_token(user_id)
        if not access_token:
            raise HTTPException(status_code=400, detail="Google Calendar is not connected.")
            
        meds = (
            supabase.table("medicines")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        
        synced_count = 0
        for med in (meds.data or []):
            event_ids = med.get("google_event_ids") or []
            if not event_ids:
                new_ids = sync_medicine_to_google_calendar(med, timezone)
                if new_ids:
                    supabase.table("medicines").update({
                        "google_event_ids": new_ids
                    }).eq("id", med["id"]).execute()
                    synced_count += 1
                    
        return {"status": "success", "synced_medicines_count": synced_count}
    except Exception as e:
        print(f"❌ sync_all_medicines error: {e}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


# ── Medicine CRUD Endpoints ───────────────────────────────────────────────────
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
        medicine_db = result.data[0] if result.data else row
        
        # Sync to Google Calendar
        event_ids = []
        try:
            event_ids = sync_medicine_to_google_calendar(medicine_db, body.timezone or "UTC")
        except Exception as e:
            print(f"⚠️ Failed to sync to Google Calendar: {e}")
            
        if event_ids:
            try:
                supabase.table("medicines").update({
                    "google_event_ids": event_ids
                }).eq("id", medicine_db["id"]).execute()
                medicine_db["google_event_ids"] = event_ids
            except Exception as e:
                print(f"⚠️ Failed to update google_event_ids in DB: {e}")
                
        return {"medicine": medicine_db}
    except Exception as e:
        print(f"❌ create_medicine error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str, user_id: str = Depends(get_current_user_id)):
    """Soft-delete a medicine (set is_active=false) and remove from Google Calendar."""
    try:
        # Fetch event IDs to delete them from Google Calendar
        med_res = (
            supabase.table("medicines")
            .select("google_event_ids")
            .eq("id", medicine_id)
            .eq("user_id", user_id)
            .execute()
        )
        if med_res.data:
            event_ids = med_res.data[0].get("google_event_ids") or []
            if event_ids:
                try:
                    delete_google_calendar_events(user_id, event_ids)
                except Exception as e:
                    print(f"⚠️ Error deleting Google Calendar events: {e}")
                    
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
    """Calculate adherence stats."""
    try:
        meds = (
            supabase.table("medicines")
            .select("id, times, doses_per_day")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        active_meds = meds.data or []
        today_total = sum(len(m.get("times", [])) for m in active_meds)

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

        search_start = (date.today() - timedelta(days=365)).isoformat()
        all_logs_res = (
            supabase.table("medicine_logs")
            .select("taken_at")
            .eq("user_id", user_id)
            .gte("taken_at", f"{search_start}T00:00:00")
            .execute()
        )
        
        logged_dates = {datetime.fromisoformat(log["taken_at"]).date() for log in (all_logs_res.data or [])}
        
        streak = 0
        check_date = date.today()
        
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
