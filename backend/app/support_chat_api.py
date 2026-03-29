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

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    # The payload for the OpenRouter API
    json_payload = {
        "model": "nvidia/nemotron-nano-12b-v2-vl:free",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a friendly and helpful customer support assistant for a web application called 'HealthMate AI'. "
                    "Your primary role is to answer questions about the app's features and how to use them. "
                    "The app has the following features: Dashboard, Risk Predictor (for uploading medical reports), "
                    "Medication Planner, Symptom Decoder, and an AI Health Companion chat. "
                    "You MUST NOT provide any medical advice or health information. "
                    "If a user asks a health-related question, you must politely redirect them to use the 'AI Health Companion' feature or consult a real doctor. "
                    "Keep your answers concise and focused on helping the user navigate the app."
                )
            },
            {
                "role": "user",
                "content": user_message
            }
        ]
    }

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=json_payload,
            timeout=30
        )
        response.raise_for_status()

        result = response.json()
        ai_response_text = result["choices"][0]["message"]["content"]
        
        print(f"🤖 Support Bot Response: '{ai_response_text}'")
        return SupportChatOut(response=ai_response_text)

    except requests.exceptions.RequestException as e:
        print(f"❌ API Request Error: {e}")
        raise HTTPException(status_code=503, detail="The support service is currently unavailable.")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")