# 🩺 HealthMate AI  
### Generative AI Powered Preventive Healthcare Assistant

HealthMate AI is an intelligent healthcare web application that transforms medical reports into AI-generated health insights. It combines OCR, Machine Learning, and Generative AI to predict disease risks and explain medical data in simple, understandable language.

---

## 🚀 Problem

Medical reports contain complex clinical values (CBC, glucose, cholesterol, etc.), but:

- Most patients cannot interpret medical terminology
- Reports provide raw numbers without explanations
- Early disease risks often go unnoticed
- There is a gap between diagnostics and preventive action

---

## 💡 Solution

HealthMate AI converts static medical reports into:

- 📊 Structured health data (via OCR)
- 🧠 Disease risk predictions (ML model)
- 🗣 AI-generated medical explanations (LLM API)
- 🛡 Personalized preventive recommendations
- 🤖 Conversational AI health companion

---

## 🏗 Architecture Overview

User Upload  
↓  
OCR Extraction (Extract structured medical values)  
↓  
ML Risk Prediction Model  
↓  
Generative AI Explanation Layer  
↓  
Personalized Preventive Insights + AI Chat  

---

## 🧠 Core Technologies

### Frontend
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Supabase Auth

### Backend
- FastAPI (Python)
- OCR processing
- ML Risk Prediction Models
- Generative AI API integration

### Database
- Supabase (Auth + Profiles + Data Storage)

---

## 🔬 How It Works

1. User uploads a medical report image.
2. OCR extracts key medical parameters.
3. Extracted values are passed to a trained ML model.
4. The model predicts disease risk probability.
5. Generative AI explains:
   - What the values mean
   - Why the risk exists
   - What preventive actions to take
6. User can chat with AI for further clarification.

---

## 🌍 Key Features

- ✅ Secure authentication
- ✅ Dashboard with health summary
- ✅ Risk prediction module
- ✅ AI-generated medical explanations
- ✅ Personalized preventive suggestions
- ✅ AI Health Companion chat
- 🔜 Medicine scheduler (in progress)
- 🔜 Wearable data integration (future scope)

---

## 🔥 Why This Is a GenAI Project

HealthMate AI does not just predict disease risk.

It uses Generative AI to:

- Convert structured medical data into intelligent narratives
- Explain risk probabilities in human-friendly language
- Provide contextual preventive recommendations
- Enable interactive conversational healthcare support

This bridges the gap between medical diagnostics and patient understanding.

---

## 📈 Future Scope

- Integration with wearable devices
- Continuous health monitoring
- Multilingual AI explanations
- Population-scale preventive analytics
- Personalized health planning engine

---

## ⚙️ Installation (Development Setup)

```bash
# Clone the repository
git clone <your-repo-link>

# Navigate into project
cd healthmate-ai

# Install frontend dependencies
cd frontend
npm install
npm run dev

# Run backend (FastAPI)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
