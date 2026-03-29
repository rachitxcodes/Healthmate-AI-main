# prediction_api1.py

import os
import json
import joblib
import numpy as np
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

# ── Config ────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
# models/ sits in backend/, one level up from backend/app/
MODEL_DIR = os.path.join(BASE_DIR, "..", "models")

router = APIRouter()

# ── Alias Table ───────────────────────────────────────────────────────────────
# Maps standard feature names → all OCR variants we might see
ALIASES = {
    # Anemia / CBC
    "HGB":      ["hemoglobin (hb)", "hemoglobin", "hb", "hgb", "haemoglobin"],
    "RBC":      ["total rbc count", "rbc count", "rbc", "red blood cell", "total rbc", "red blood cells"],
    "MCV":      ["mean corpuscular volume (mcv)", "mean corpuscular volume", "mcv"],
    "MCH":      ["mean corpuscular hemoglobin (mch)", "mean corpuscular hemoglobin", " mch"],
    "MCHC":     ["mean corpuscular hemoglobin concentration (mchc)", "mean corpuscular hemoglobin concentration", "mchc"],
    "RDW":      ["red cell distribution width", "rdw-cv", "rdw-sd", " rdw"],
    "PCV":      ["packed cell volume (pcv)", "packed cell volume", "pcv", "hematocrit", "hct"],
    "WBC":      ["total wbc count", "wbc count", "total wbc", "wbc",
                 "white blood cell", "leukocyte"],
    "TLC":      ["tlc", "total leucocyte count", "total leukocyte count",
                 "total wbc count", "wbc count", "total wbc", "wbc"],
    "Platelets":["platelet count", "platelets", "thrombocyte count", "thrombocyte"],
    "PLT /mm3": ["plt /mm3", "plt/mm3", "plt", "platelet count", "platelets"],

    # Diabetes
    "Pregnancies":              ["pregnancies", "number of pregnancies"],
    "Glucose":                  ["glucose", "blood glucose", "fasting glucose", "plasma glucose"],
    "BloodPressure":            ["blood pressure", "bp", "diastolic bp", "diastolic blood pressure"],
    "SkinThickness":            ["skin thickness", "triceps skin fold thickness"],
    "Insulin":                  ["insulin", "serum insulin", "2-hour insulin"],
    "BMI":                      ["bmi", "body mass index"],
    "DiabetesPedigreeFunction": ["diabetes pedigree", "pedigree function", "diabetes pedigree function"],

    # Heart
    "cp":       ["chest pain", "chest pain type", "cp"],
    "trestbps": ["resting blood pressure", "trestbps", "resting bp"],
    "chol":     ["cholesterol", "serum cholesterol", "chol"],
    "fbs":      ["fasting blood sugar", "fbs"],
    "restecg":  ["resting ecg", "rest ecg", "restecg", "resting electrocardiographic"],
    "thalach":  ["max heart rate", "maximum heart rate", "thalach"],
    "exang":    ["exercise induced angina", "exang"],
    "oldpeak":  ["st depression", "oldpeak"],
    "slope":    ["slope", "slope of peak exercise st segment"],
    "ca":       ["number of major vessels", "ca", "major vessels"],
    "thal":     ["thal", "thalassemia"],

    # Liver
    "Total_Bilirubin":              ["total bilirubin", "bilirubin total", "t. bilirubin"],
    "Direct_Bilirubin":             ["direct bilirubin", "bilirubin direct", "d. bilirubin"],
    "Alkaline_Phosphotase":         ["alkaline phosphatase", "alp", "alkaline phosphotase"],
    "Alamine_Aminotransferase":     ["alanine aminotransferase", "alt", "sgpt", "alamine aminotransferase"],
    "Aspartate_Aminotransferase":   ["aspartate aminotransferase", "ast", "sgot"],
    "Total_Protiens":               ["total protein", "total proteins", "total protiens"],
    "Albumin":                      ["albumin"],
    "Albumin_and_Globulin_Ratio":   ["albumin globulin ratio", "a/g ratio", "ag ratio"],

    "S. No.":   ["s. no.", "s.no.", "sr. no.", "serial no", "sno", "s no"],
    # Shared
    "Age":      ["age"],
    "Sex":      ["sex", "gender"],
}

IGNORE_KEYWORDS = [
    "unit", "reference", "range", "normal", "flag", "method",
    "pid", "p.id", "patient id", "instrument",
    "reported", "collected", "registered",
    "sample type", "primary sample", "absolute", "rdw-sd", "rdw (small"
]


# ── Numeric Cleaning ──────────────────────────────────────────────────────────
def clean_numeric(value):
    if value is None:
        return None

    s = str(value).lower().strip()

    if s in ["male", "female", "m", "f"]:
        return s

    # Ignore reference range values like "11.6-14.0 %" — has a dash between two numbers
    if re.search(r'\d+\.?\d*\s*-\s*\d+\.?\d*', s):
        return None

    # Ignore "21 years" type age strings — keep just number
    s = re.sub(r'\byears?\b', '', s).strip()

    s = s.replace(",", "")

    if "million" in s:
        m = re.search(r"\d*\.?\d+", s)
        if m:
            return float(m.group()) * 1_000_000

    if "%" in s:
        m = re.search(r"\d*\.?\d+", s)
        if m:
            return float(m.group())

    m = re.search(r"[-+]?\d*\.?\d+", s)
    if m:
        return float(m.group())

    return None


# ── Normalize OCR output → ML-ready features ─────────────────────────────────
def normalize_input_data(raw_json: dict) -> dict:
    normalized = {}

    # Sort aliases by specificity (longest alias first) to match MCHC before MCH etc.
    sorted_aliases = sorted(ALIASES.items(), key=lambda x: max(len(a) for a in x[1]), reverse=True)

    for key_raw, value in raw_json.items():
        key_clean = key_raw.lower().strip()

        if any(kw in key_clean for kw in IGNORE_KEYWORDS):
            continue

        for std_key, variants in sorted_aliases:
            if std_key in normalized:
                continue

            matched = False
            for alias in sorted(variants, key=len, reverse=True):
                alias_clean = alias.strip()
                # Exact match OR alias is fully contained in key as whole word
                if key_clean == alias_clean:
                    matched = True
                    break
                # alias contained in key with word boundaries
                if re.search(r'(?<![a-z])' + re.escape(alias_clean) + r'(?![a-z])', key_clean):
                    matched = True
                    break

            if matched:
                cleaned = clean_numeric(value)
                if cleaned is not None:
                    normalized[std_key] = cleaned

    return normalized


# ── Categorical Encoding ──────────────────────────────────────────────────────
def encode_categorical(feature, value):
    if feature in ("Sex", "Gender"):
        if isinstance(value, str):
            return 1 if value.startswith("m") else 0
    return value


# ── Run All Models ────────────────────────────────────────────────────────────
def run_prediction_for_all_models(normalized_data: dict) -> dict:
    results = {}

    if not os.path.exists(MODEL_DIR):
        raise FileNotFoundError(f"Model directory not found: {MODEL_DIR}")

    for meta_file in sorted(os.listdir(MODEL_DIR)):
        if not meta_file.endswith("_metadata.pkl"):
            continue

        disease_name = meta_file.replace("_metadata.pkl", "")

        try:
            meta   = joblib.load(os.path.join(MODEL_DIR, f"{disease_name}_metadata.pkl"))
            model  = joblib.load(os.path.join(MODEL_DIR, f"{disease_name}_model_calibrated.pkl"))
            scaler = joblib.load(os.path.join(MODEL_DIR, f"{disease_name}_scaler.pkl"))
        except FileNotFoundError:
            print(f"⚠ Missing model files for: {disease_name}")
            continue
        except Exception as e:
            print(f"⚠ Error loading {disease_name}: {e}")
            continue

        required = meta["features"]
        medians  = meta["feature_medians"]

        matched = [f for f in required if f in normalized_data]
        missing = [f for f in required if f not in normalized_data]

        # Need at least 40% of features to run
        if len(matched) < max(1, int(0.4 * len(required))):
            results[disease_name] = {
                "ran": False,
                "reason": f"Not enough data — matched {len(matched)}/{len(required)} features",
                "matched_features": matched,
                "missing_features": missing,
            }
            continue

        # Build feature vector (use median for missing features)
        feature_vec = []
        for feat in required:
            val = normalized_data.get(feat, medians[feat])
            val = encode_categorical(feat, val)
            feature_vec.append(val)

        try:
            X        = np.array(feature_vec).reshape(1, -1)
            X_scaled = scaler.transform(X)
            prob     = float(model.predict_proba(X_scaled)[0][1])

            results[disease_name] = {
                "ran":              True,
                "risk_probability": prob,
                "risk_percent":     f"{prob * 100:.1f}%",
                "matched_features": matched,
                "missing_features": missing,
            }
        except Exception as e:
            results[disease_name] = {
                "ran":    False,
                "reason": f"Prediction error: {str(e)}",
                "matched_features": matched,
                "missing_features": missing,
            }

    return results


# ── Main Pipeline Function (called by main.py) ────────────────────────────────
def process_report_data(raw_json_data: dict) -> dict:
    print("\n🔄 Normalizing raw OCR data...")
    normalized = normalize_input_data(raw_json_data)
    print("📦 Normalized features:", json.dumps(normalized, indent=2))

    print("\n🤖 Running prediction models...")
    predictions = run_prediction_for_all_models(normalized)
    print("📊 Results:", json.dumps(
        {k: v.get("risk_percent", v.get("reason", "?")) for k, v in predictions.items()},
        indent=2
    ))

    return predictions


# ── API Route: /predict-risk ──────────────────────────────────────────────────
# Called by ReportResult.tsx after user reviews & confirms extracted data

class PredictRequest(BaseModel):
    features: dict[str, Any]

@router.post("/predict-risk")
async def predict_risk(body: PredictRequest):
    """
    Accepts the (optionally edited) extracted_data from the frontend,
    runs all disease models, returns predictions.
    """
    if not body.features:
        raise HTTPException(status_code=400, detail="No features provided")

    try:
        predictions = process_report_data(body.features)
        return {"predictions": predictions}
    except Exception as e:
        print("❌ predict-risk error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── API Route: /explain ───────────────────────────────────────────────────────
# Called when user clicks "Get AI Explanation & Precautions"

import httpx
import os

class ExplainRequest(BaseModel):
    disease: str
    risk_percent: str
    matched_features: list[str]
    extracted_data: dict[str, Any]

@router.post("/explain")
async def explain_risk(body: ExplainRequest):
    """
    Uses a free OpenRouter text model to generate:
    - Plain-language explanation of the risk
    - Personalized precautions based on the actual values
    """
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not set")

    # Build a concise summary of the patient's values
    values_summary = ", ".join(
        f"{k}: {v}" for k, v in body.extracted_data.items()
        if k in body.matched_features
    )

    prompt = f"""You are a friendly, caring health assistant explaining medical results to a patient in simple everyday language.

Disease analyzed: {body.disease.replace("_", " ").title()}
Risk score: {body.risk_percent}
Patient's values: {values_summary}

Write in warm, reassuring, simple language — like a caring doctor talking to a patient.
Avoid medical jargon. Do not alarm the patient unnecessarily.

Return ONLY this exact JSON (no markdown, no extra text):
{{
  "explanation": "2-3 friendly sentences explaining what this risk score means in simple terms, mentioning their specific values naturally. Be warm and reassuring while being honest.",
  "precautions": [
    "Simple everyday action they can take",
    "Diet or lifestyle suggestion",
    "Another practical tip",
    "When to see a doctor",
    "One positive encouragement"
  ]
}}"""

    # Free text models — no vision needed, much less rate limited
    TEXT_MODELS = [
        "nvidia/nemotron-nano-12b-v2-vl:free",
        "google/gemma-3-12b-it:free",
        "google/gemma-3-4b-it:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
        "meta-llama/llama-3.2-3b-instruct:free",
    ]

    last_error = None
    for model in TEXT_MODELS:
        try:
            print(f"🤖 Explain: trying {model}...")
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:5173",
                        "X-Title": "HealthMate AI",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 600,
                    },
                )

            if response.status_code != 200:
                err = response.json().get("error", {})
                print(f"⚠️ {model} failed: {err.get('message','')[:80]}")
                last_error = str(err)
                continue

            content = response.json()["choices"][0]["message"]["content"].strip()

            # Strip markdown fences
            if content.startswith("```"):
                parts = content.split("```")
                content = parts[1] if len(parts) > 1 else parts[0]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            parsed = json.loads(content)
            print(f"✅ Explanation generated by {model}")
            return {
                "explanation": parsed.get("explanation", ""),
                "precautions": parsed.get("precautions", []),
            }

        except json.JSONDecodeError:
            # Model returned text not JSON — extract what we can
            print(f"⚠️ {model} returned non-JSON, using raw text")
            return {
                "explanation": content[:500] if 'content' in dir() else "Unable to generate explanation.",
                "precautions": [],
            }
        except Exception as e:
            print(f"❌ Error with {model}: {e}")
            last_error = str(e)
            continue

    raise HTTPException(
        status_code=502,
        detail=f"Could not generate explanation. Try again in a moment. Last error: {last_error}"
    )