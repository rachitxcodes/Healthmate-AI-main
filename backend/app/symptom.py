# File: symptom.py
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import List, Optional
import os
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# --- Config ---
SUPABASE_URL = f"https://{os.getenv('SUPABASE_PROJECT_ID')}.supabase.co"
SUPABASE_SVC_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SVC_KEY)

# --- Rule-Based Scorer ---
# Weights on a 0-100 scale for clinical concern
SYMPTOM_RULES = {
    "chest pain": 30,
    "shortness of breath": 25,
    "dizziness": 20,
    "fever": 15,
    "extreme fatigue": 20,
    "nausea": 10,
    "persistent cough": 10,
    "body aches": 10,
    "loss of appetite": 5,
    "sore throat": 5,
    "headache": 5,
    "chills": 10,
    "weakness": 10,
    "fatigue": 15
}

# --- Pydantic Models ---
class SymptomsIn(BaseModel):
    symptoms: List[str]
    user_id: Optional[str] = None # Added for manual/hardware sync if needed

class PredictOut(BaseModel):
    total_score: int
    risk_level: str
    breakdown: dict

# --- Mock load_artifacts for main.py compatibility ---
def load_artifacts():
    """Placeholder to maintain main.py stability without ML files."""
    print("ℹ️ Rule-Based Symptom Engine initialized (No ML artifacts required)")

# --- Endpoints ---
@router.post("/predict", response_model=PredictOut, tags=["Predictions"])
def predict(payload: SymptomsIn):
    """
    Calculate a rule-based risk score based on symptoms.
    """
    symptoms = [s.lower() for s in payload.symptoms]
    total_score = 0
    breakdown = {}

    for s in symptoms:
        weight = SYMPTOM_RULES.get(s, 5) # Default weight 5 for unknown symptoms
        total_score += weight
        breakdown[s] = weight

    # Cap at 100
    total_score = min(100, total_score)

    # Determine Severity
    if total_score <= 15:
        risk_level = "Stable"
    elif total_score <= 40:
        risk_level = "Warning"
    else:
        risk_level = "Critical"

    return {
        "total_score": total_score,
        "risk_level": risk_level,
        "breakdown": breakdown
    }

@router.post("/sync", tags=["Predictions"])
async def sync_symptoms(payload: SymptomsIn):
    """
    Saves the symptom score to Supabase so the Risk Engine can use it.
    Requires a user_id from the frontend (Supabase Auth).
    """
    if not payload.user_id:
        raise HTTPException(status_code=400, detail="User ID required for sync")

    # Calculate score using the same logic
    result = predict(payload)
    
    try:
        supabase.table("user_symptom_scores").insert({
            "user_id": payload.user_id,
            "symptoms": payload.symptoms,
            "score": result["total_score"],
            "risk_level": result["risk_level"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        return {"status": "synced", "score": result["total_score"]}
    except Exception as e:
        print(f"❌ Sync failed: {e}")
        raise HTTPException(status_code=500, detail="Database sync failed")


@router.get("/latest", tags=["Predictions"])
async def get_latest_symptoms(user_id: str = Query(...)):
    """
    Returns the most recently synced symptom list and score for a user.
    Used by the frontend to restore the active symptom selection on page load.
    """
    try:
        result = (
            supabase.table("user_symptom_scores")
            .select("symptoms, score, risk_level, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return {
                "symptoms": row["symptoms"],
                "score": row["score"],
                "risk_level": row["risk_level"],
                "synced_at": row["created_at"]
            }
        return {"symptoms": [], "score": 0, "risk_level": "Stable", "synced_at": None}
    except Exception as e:
        print(f"⚠️ get_latest_symptoms: {e}")
        return {"symptoms": [], "score": 0, "risk_level": "Stable", "synced_at": None}