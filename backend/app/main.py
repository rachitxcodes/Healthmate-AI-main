import os
import uuid
import base64
import httpx
from jose import jwt

from typing import Any, Union
from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from dotenv import load_dotenv

from app.ai_companion_api import router as ai_router
from app.symptom import router as symptom_router, load_artifacts
from app.prediction_api1 import router as prediction_router, process_report_data
from app.medicine_api import router as medicine_router
from app.support_chat_api import router as support_bot_router
from app.vitals_api import router as vitals_router

load_dotenv()

SUPABASE_PROJECT_ID = os.getenv("SUPABASE_PROJECT_ID")
SUPABASE_JWT_ISSUER = os.getenv("SUPABASE_JWT_ISSUER")
OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY")

print("✅ Env loaded")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://ai-healthmate.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.options("/{path:path}")
async def options_handler(path: str, request: Request):
    return Response(status_code=200)

# ── Auth ──────────────────────────────────────────────────────────────────────
async def get_current_user_id(authorization: str = Header(None)):
    return "test user"

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    print("🚀 Loading ML artifacts...")
    load_artifacts()
    print("✅ ML models loaded. Server ready.")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(symptom_router, prefix="/api")
app.include_router(ai_router, prefix="/api2")
app.include_router(prediction_router, prefix="/api1")
app.include_router(medicine_router, prefix="/api")
app.include_router(support_bot_router, prefix="/api")
app.include_router(vitals_router, prefix="/api3")

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "HealthMate backend running"}

# ── OCR via OpenRouter Vision (with retry + delay) ────────────────────────────
async def extract_medical_values_via_llm(image_bytes: Any, mime_type: str) -> dict:
    import json
    import asyncio

    MODELS = [
        "google/gemma-3-4b-it:free",
        "google/gemma-3-12b-it:free",
        "google/gemma-3-27b-it:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
    ]

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    prompt = (
        "You are a medical OCR assistant. "
        "Look at this medical report image and extract every test name and its value. "
        "Return ONLY a valid JSON object — no explanation, no markdown, no code fences. "
        "Keys should be test names exactly as written (e.g. 'Hemoglobin', 'RBC Count'). "
        "Values should be the raw value string including units "
        "(e.g. '13.5 g/dL', '5.2 million/cumm', 'Male'). "
        "Also extract Age and Sex if present. "
        "Example: {\"Hemoglobin\": \"13.5 g/dL\", \"Age\": \"45\", \"Sex\": \"Male\"}"
    )

    # Try each model up to 3 rounds with delay between rounds
    for round in range(3):
        if round > 0:
            wait = round * 30
            print(f"⏳ Round {round+1}: waiting {wait}s before retry...")
            await asyncio.sleep(wait)

        for model in MODELS:
            try:
                print(f"🔄 Trying {model}...")
                payload = {
                    "model": model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
                            {"type": "text", "text": prompt},
                        ],
                    }],
                    "max_tokens": 1000,
                }

                async with httpx.AsyncClient(timeout=60) as client:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "http://localhost:5173",
                            "X-Title": "HealthMate AI",
                        },
                        json=payload,
                    )

                if response.status_code != 200:
                    err = response.json().get("error", {})
                    print(f"⚠️ {model} failed: {err.get('message', '')[:80]}")
                    continue

                content = response.json()["choices"][0]["message"]["content"].strip()
                print(f"✅ Got response from {model}")

                if content.startswith("```"):
                    parts = content.split("```")
                    content = parts[1] if len(parts) > 1 else parts[0]
                    if content.startswith("json"):
                        content = content[4:]
                    content = content.strip()

                extracted = json.loads(content)
                print(f"✅ Extracted {len(extracted)} fields")
                return extracted

            except json.JSONDecodeError as e:
                print(f"❌ JSON error from {model}: {e}")
                continue
            except Exception as e:
                print(f"❌ Error with {model}: {e}")
                continue

    raise HTTPException(
        status_code=502,
        detail="All OCR models are rate-limited. Please try again in 2-3 minutes."
    )


# ── Upload + Full Pipeline ────────────────────────────────────────────────────
@app.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_id   = str(uuid.uuid4())
    file_path = os.path.join(upload_dir, f"{file_id}_{file.filename}")

    try:
        image_bytes = await file.read()
        with open(file_path, "wb") as f:
            f.write(image_bytes)
        print(f"📥 Received: {file.filename}")

        print("🔍 Sending to Gemini OCR...")
        extracted_data = await extract_medical_values_via_llm(
            image_bytes, file.content_type or "image/jpeg"
        )
        print("✅ OCR extracted:", extracted_data)

        print("🤖 Running ML predictions...")
        predictions = process_report_data(extracted_data)
        print("📊 Predictions complete")

        return {
            "message": "Report processed successfully",
            "extracted_data": extracted_data,
            "predictions": predictions,
        }

    except HTTPException:
        raise
    except Exception as e:
        print("❌ Pipeline error:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as cleanup_err:
            print("⚠️ Cleanup failed:", cleanup_err)