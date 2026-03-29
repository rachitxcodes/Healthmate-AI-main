# File: symptom.py

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List
import joblib
import os
import numpy as np

# 1. Create an APIRouter instead of a FastAPI app
# This router will be imported and included by main.py
router = APIRouter()

# --- Pydantic Model for this specific API ---
class SymptomsIn(BaseModel):
    symptoms: List[str]


# --- Globals and paths specific to the prediction logic ---
MODEL_PATH = os.path.join("models", "symbipredict_model.joblib")
MLB_PATH = os.path.join("models", "mlb.joblib")
FEATURE_NAMES_PATH = os.path.join("models", "feature_names.joblib")

# These will be populated at startup by the main app
model = None
mlb = None
feature_names = None


# --- The loading function (without the @app.on_event decorator) ---
def load_artifacts():
    """Loads ML artifacts from disk into this module's global variables."""
    global model, mlb, feature_names
    
    print("Attempting to load ML model artifacts from symptom.py...")
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model not found at {MODEL_PATH}. Run training script first.")
    
    model = joblib.load(MODEL_PATH)
    print(f"Model loaded successfully from {MODEL_PATH}")

    if os.path.exists(MLB_PATH):
        mlb = joblib.load(MLB_PATH)
        print(f"MultiLabelBinarizer (mlb) loaded from {MLB_PATH}")
    elif os.path.exists(FEATURE_NAMES_PATH):
        feature_names = joblib.load(FEATURE_NAMES_PATH)
        print(f"Feature names loaded from {FEATURE_NAMES_PATH}")
    else:
        print("Warning: Neither mlb.joblib nor feature_names.joblib found.")


# --- Helper function for vectorizing input ---
def vectorize_input(symptoms: List[str]) -> np.ndarray:
    """Convert incoming symptom list to model input vector."""
    cleaned = [s.strip().lower() for s in (symptoms or [])]
    if mlb is not None:
        return np.asarray(mlb.transform([cleaned])[0])
    elif feature_names is not None:
        sset = set(cleaned)
        return np.array([1 if fn.lower() in sset else 0 for fn in feature_names])
    else:
        try:
            n = model.n_features_in_
            return np.zeros(n, dtype=int)
        except AttributeError:
            raise HTTPException(status_code=500, detail="Model is loaded, but no vectorizer (mlb/feature_names) is available.")


# --- Endpoints attached to the router ---
@router.get("/health", tags=["Predictions"])
def health():
    """Health check for the prediction service."""
    return {"status": "ok", "service": "symptom-predictor"}


@router.post("/predict", tags=["Predictions"])
def predict(payload: SymptomsIn, top_k: int = Query(3, ge=1, le=20)):
    """
    Return top-k class predictions with probabilities based on symptoms.
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded. Check server startup logs.")

    vec = vectorize_input(payload.symptoms)
    X = np.asarray(vec).reshape(1, -1)
    
    try:
        if hasattr(model, 'predict_proba') and hasattr(model, 'classes_'):
            proba = model.predict_proba(X)[0]
            classes = model.classes_
            
            paired = sorted(zip(classes.tolist(), proba.tolist()), key=lambda x: x[1], reverse=True)
            top = paired[:top_k]
            preds = [{"class": str(c), "probability": float(p)} for c, p in top]
            
            return {"predictions": preds}
        else:
            # Fallback for models without predict_proba
            pred = model.predict(X)[0]
            return {"predictions": [{"class": str(pred), "probability": None}]}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")