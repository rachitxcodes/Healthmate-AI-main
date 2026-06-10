# File: support_chat_api.py

import os
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# --- 1. SETUP AND CONFIGURATION ---
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    raise Exception("❌ ERROR: OPENROUTER_API_KEY missing in .env file!")

router = APIRouter()

# --- 2. PYDANTIC MODELS (Data Shapes) ---

class SupportChatIn(BaseModel):
    message: str

class SupportChatOut(BaseModel):
    response: str

# --- 3. THE API ENDPOINT ---

@router.post("/support-chat", response_model=SupportChatOut)
async def handle_support_query(payload: SupportChatIn):
    """
    Receives a user query about the app, gets a helpful response from an LLM,
    and returns the AI's reply.
    """
    user_message = payload.message
    print(f"💬 Received support query: '{user_message}'")

    # 1. Try direct Google AI Studio Gemini API first if key exists
    gemini_key = os.getenv("GEMINI_API_KEY")
    system_instruction = (
        "You are a friendly and helpful customer support assistant for a web application called 'HealthMate AI'. "
        "Your primary role is to answer questions about the app's features and how to use them. "
        "The app has the following key features:\n"
        "- **Dashboard**: Visualizes a high-level summary of your health, predictions, and active medication list.\n"
        "- **Vitals Dashboard**: Shows live vitals (Heart Rate, SpO2, and body Temperature) streamed from a connected ESP32 hardware device. If hardware is disconnected, it shows a 'NO HARDWARE CONNECTED' alert banner and displays the last recorded real values to prevent value fluctuations.\n"
        "- **Risk Predictor**: Allows users to upload medical report images to extract lab values (via OCR) and calculate risks for diseases like diabetes, cardiovascular disease, etc.\n"
        "- **Medication Planner**: A scheduler where users can add medication names, dosages, frequencies, and times, keeping track of active medications.\n"
        "- **Symptom Decoder**: A rule-based tool that takes user symptoms and helps triage them to understand possible causes and recommend actions.\n"
        "- **AI Doctor**: A dedicated full-page medical assistant named Dr. HealthMate that has access to your medical history and medications to answer health questions. (Direct users here or to a doctor for medical advice).\n\n"
        "You MUST NOT provide any medical advice or health information. "
        "If a user asks a health-related question, you must politely redirect them to use the 'AI Doctor' feature or consult a real doctor. "
        "Keep your answers concise and focused on helping the user navigate the app."
    )

    if gemini_key:
        print("🔍 Trying direct Google AI Studio Gemini API first...")
        for gemini_model in ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"]:
            try:
                print(f"🔄 Trying direct Gemini model: {gemini_model}...")
                payload = {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": user_message}]
                        }
                    ],
                    "systemInstruction": {
                        "parts": [{"text": system_instruction}]
                    }
                }
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
                response = requests.post(url, json=payload, timeout=30)
                if response.status_code == 200:
                    result = response.json()
                    ai_response_text = result["candidates"][0]["content"]["parts"][0]["text"]
                    print(f"✅ Direct Gemini model {gemini_model} response: '{ai_response_text[:80]}...'")
                    return SupportChatOut(response=ai_response_text)
                else:
                    print(f"⚠️ Direct Gemini model {gemini_model} failed: {response.status_code} - {response.text}")
            except Exception as e:
                print(f"⚠️ Direct Gemini model {gemini_model} error: {e}")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    PRIMARY_MODEL = "google/gemma-4-31b-it:free"
    FALLBACK_MODEL = "google/gemma-4-26b-a4b-it:free"

    # The payload for the OpenRouter API
    json_payload = {
        "messages": [
            {
                "role": "system",
                "content": system_instruction
            },
            {
                "role": "user",
                "content": user_message
            }
        ]
    }

    # Try primary and fallback models
    for model in [PRIMARY_MODEL, FALLBACK_MODEL]:
        json_payload["model"] = model
        try:
            print(f"🤖 Trying support model: {model}")
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=json_payload,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            ai_response_text = result["choices"][0]["message"]["content"]
            print(f"✅ Support Bot Response from {model}: '{ai_response_text[:80]}...'")
            return SupportChatOut(response=ai_response_text)
        except Exception as e:
            print(f"⚠️ Support model {model} failed: {e}")
            continue

    raise HTTPException(
        status_code=503,
        detail="The support service is currently unavailable. Please try again later."
    )