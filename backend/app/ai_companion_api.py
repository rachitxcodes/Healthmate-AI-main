# File: ai_companion_api.py

import os
import re
import requests
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# --- 1. SETUP AND CONFIGURATION ---
load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL = f"https://{os.getenv('SUPABASE_PROJECT_ID')}.supabase.co"
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not OPENROUTER_API_KEY:
    raise Exception("❌ ERROR: OPENROUTER_API_KEY missing in .env file!")
if not SUPABASE_ANON_KEY:
    raise Exception("❌ ERROR: SUPABASE_ANON_KEY missing in .env file!")

SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter()
security = HTTPBearer()

PRIMARY_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"
FALLBACK_MODEL = "mistralai/mistral-small-3.1-24b-instruct:free"

SYSTEM_PROMPT = (
    "You are Dr. HealthMate, a personal AI health companion. "
    "You have the user's actual health report data in your context. Always use it. "

    "MOST IMPORTANT RULE: "
    "When the user asks about their report or health results, you MUST reference their actual values "
    "from the report summary. Never ask them to share values — you already have them. "
    "Never give generic health advice when report data is available. "
    "Speak directly about their specific numbers in simple plain language. "

    "HOW TO RESPOND ABOUT REPORTS: "
    "Start with the most important finding from their report. "
    "Mention their actual value and what it means in one simple sentence. "
    "Tell them if it is concerning or not, and why in plain words. "
    "Give one practical suggestion based on their result. "
    "End with one question. "
    "Keep it under 4 sentences total. "

    "HOW TO RESPOND TO GENERAL HEALTH QUESTIONS: "
    "Answer like a friendly knowledgeable doctor. Keep it short — 2 to 3 sentences. "
    "End with one question. "

    "STRICT RULES: "
    "Never use bullet points, numbered lists, bold, asterisks, or any markdown. "
    "Never write more than 4 sentences per response. "
    "Never ask the user to share values you already have. "
    "Never give a wall of text. Short, clear, conversational always. "
    "You may reference the user's current medications when relevant. "
    "Recommend a doctor for treatment decisions. "
    "Address the user by their first name naturally. "
)


# --- 2. AUTH HELPER ---

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
            raise HTTPException(status_code=401, detail="Could not extract user ID from token.")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed.")


# --- 3. PYDANTIC MODELS ---

class ChatIn(BaseModel):
    message: str
    report_context: Optional[str] = None  # frontend fallback if no DB report

class ChatOut(BaseModel):
    response: str

class HistoryMessage(BaseModel):
    role: str
    content: str
    created_at: Optional[str] = None

class HistoryOut(BaseModel):
    messages: list[HistoryMessage]


# --- 4. MARKDOWN STRIPPER ---

def strip_markdown(text: str) -> str:
    text = re.sub(r'\*{1,3}(.*?)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,2}(.*?)_{1,2}', r'\1', text)
    text = re.sub(r'#{1,6}\s+', '', text)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*[-•*]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'`{1,3}.*?`{1,3}', '', text, flags=re.DOTALL)
    text = re.sub(r'[^\x00-\x7F]+', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


# --- 5. SUPABASE HELPERS ---

def fetch_chat_history(user_id: str) -> list[dict]:
    try:
        result = (
            supabase.table("chat_history")
            .select("role, content, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return list(reversed(result.data or []))
    except Exception as e:
        print(f"⚠️ Failed to fetch chat history: {e}")
        return []


def save_message(user_id: str, role: str, content: str):
    try:
        supabase.table("chat_history").insert({
            "user_id": user_id,
            "role": role,
            "content": content,
        }).execute()
    except Exception as e:
        print(f"⚠️ Failed to save message (role={role}): {e}")


def fetch_user_profile(user_id: str) -> dict:
    try:
        result = (
            supabase.table("profiles")
            .select("full_name, email")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return result.data or {}
    except Exception as e:
        print(f"⚠️ Failed to fetch profile: {e}")
        return {}


def fetch_latest_report(user_id: str) -> Optional[str]:
    """
    Fetch the most recent reports from Supabase reports table.
    Returns a clean readable summary string injected into the AI system prompt.
    Now fetches up to 3 reports for richer context.
    """
    try:
        result = (
            supabase.table("reports")
            .select("report_data, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(3)
            .execute()
        )
        if not result.data:
            return None

        all_summaries = []

        for i, row in enumerate(result.data):
            report = row["report_data"]
            created_at = row.get("created_at", "")
            report_name = report.get("name", "Medical Report")

            extracted = report.get("extracted_data", {})
            predictions = report.get("predictions", {})

            parts = [f"Report #{i+1}: {report_name} (analyzed {created_at[:10] if created_at else 'unknown date'})"]

            if extracted:
                values = ", ".join([f"{k}: {v}" for k, v in extracted.items()])
                parts.append(f"  Lab values: {values}")

            if predictions:
                for disease, pred in predictions.items():
                    if isinstance(pred, dict) and pred.get("ran"):
                        risk_pct = pred.get("risk_percent", "N/A")
                        parts.append(
                            f"  {disease.replace('_', ' ').title()} risk: {risk_pct}"
                        )

            all_summaries.append("\n".join(parts))

        # Also fetch active medicines for context
        try:
            meds_result = (
                supabase.table("medicines")
                .select("medicine_name, dosage, frequency, times")
                .eq("user_id", user_id)
                .eq("is_active", True)
                .execute()
            )
            if meds_result.data:
                med_lines = []
                for m in meds_result.data:
                    times_str = ", ".join(m.get("times", []))
                    med_lines.append(f"  {m['medicine_name']} ({m['dosage']}) - {m['frequency']}, times: {times_str}")
                all_summaries.append("Current medications:\n" + "\n".join(med_lines))
        except Exception as e:
            print(f"⚠️ Failed to fetch medicines for AI context: {e}")

        print(f"✅ Loaded {len(result.data)} report(s) from Supabase for user {user_id[:8]}...")
        return "\n\n".join(all_summaries)

    except Exception as e:
        print(f"⚠️ Failed to fetch latest report: {e}")
        return None


# --- 6. OPENROUTER CALL WITH MODEL FALLBACK ---

def call_openrouter(messages_payload: list[dict]) -> str:
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    for model in [PRIMARY_MODEL, FALLBACK_MODEL]:
        try:
            print(f"🤖 Trying model: {model}")
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json={"model": model, "messages": messages_payload},
                timeout=40,
            )
            resp.raise_for_status()
            raw_text = resp.json()["choices"][0]["message"]["content"]
            clean_text = strip_markdown(raw_text)
            print(f"✅ Response from {model}: {clean_text[:80]}...")
            return clean_text
        except Exception as e:
            print(f"⚠️ Model {model} failed: {e}")
            continue

    raise HTTPException(
        status_code=503,
        detail="All AI models are currently unavailable. Please try again later.",
    )


# --- 7. API ENDPOINTS ---

@router.get("/history", response_model=HistoryOut)
async def get_chat_history(user_id: str = Depends(get_current_user_id)):
    messages = fetch_chat_history(user_id)
    return HistoryOut(
        messages=[
            HistoryMessage(
                role=m["role"],
                content=m["content"],
                created_at=m.get("created_at"),
            )
            for m in messages
        ]
    )


@router.post("/chat", response_model=ChatOut)
async def handle_chat_message(
    payload: ChatIn,
    user_id: str = Depends(get_current_user_id),
):
    user_message = payload.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    print(f"💬 User [{user_id[:8]}...]: {user_message[:80]}")

    # Build system prompt
    system_content = SYSTEM_PROMPT

    # Inject user profile name
    profile = fetch_user_profile(user_id)
    full_name = profile.get("full_name", "").strip()
    if full_name:
        system_content += (
            f"\n\nThe user's name is {full_name}. "
            "Address them by their first name naturally throughout the conversation. "
            "Never ask for their name — you already know it."
        )

    # Inject report — prefer Supabase DB (persistent) over frontend sessionStorage (transient)
    report_context = fetch_latest_report(user_id)
    if not report_context:
        report_context = payload.report_context
        if report_context:
            print("ℹ️ Using frontend-provided report context (no DB report found)")

    if report_context:
        system_content += (
            "\n\nThe user has health reports and medication data on file. Here is the summary:\n"
            + report_context
            + "\n\nYou have access to the user's lab reports AND their current medication schedule. "
            "When the user asks about their medications, you MUST reference the actual medications listed above. "
            "When the user asks about their health or reports, reference their actual lab values. "
            "Do not claim you don't have access to their data — you do. "
            "Only volunteer this information when the user asks about it."
        )

    # Fetch conversation history
    history = fetch_chat_history(user_id)

    # Assemble messages for LLM
    messages_for_llm: list[dict] = [{"role": "system", "content": system_content}]
    for msg in history:
        if msg["role"] in ("user", "assistant"):
            messages_for_llm.append({"role": msg["role"], "content": msg["content"]})
    messages_for_llm.append({"role": "user", "content": user_message})

    # Call AI
    ai_response = call_openrouter(messages_for_llm)

    # Persist both turns
    save_message(user_id, "user", user_message)
    save_message(user_id, "assistant", ai_response)

    return ChatOut(response=ai_response)