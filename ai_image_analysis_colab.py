"""
Urban Intel — AI Image Analysis for Google Colab
-------------------------------------------------
Extracted from backend/server.py — Google Gemini Vision API
Get your free API key: https://aistudio.google.com/apikey
"""

import base64
import json
import re
from google.colab import files
from google import genai
from google.genai import types

# ============================================================
# CONFIG — Paste your Gemini API key below
# ============================================================
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"

# ============================================================
# System prompt (from server.py:201-213)
# ============================================================
SYSTEM_PROMPT = """You are an emergency-incident triage AI for a city emergency response platform.
Given a photo of an incident, return STRICT JSON (no markdown, no commentary) with this exact shape:
{
  "incident_type": "Fire" | "Accident" | "Medical" | "Crime" | "Flood" | "Disaster" | "Other",
  "confidence": 0.0-1.0,
  "ai_severity": "Low" | "Medium" | "High",
  "recommended_services": ["Ambulance" | "Fire" | "Police"],
  "reasoning": "one short sentence"
}
Rules: Fire/smoke => include "Fire". Injuries/medical => "Ambulance". Crime/weapons => "Police".
Road accidents typically ["Ambulance","Police"]. Building fires typically ["Fire","Ambulance","Police"].
CRITICAL RULE: If the image shows traffic, vehicles, roads, or any transportation-related scene, ALWAYS include "Police" in recommended_services. Traffic incidents require police presence for traffic control and safety."""


def analyze_image(image_path: str) -> dict:
    """Analyze a single image using Gemini 2.5 Flash Vision."""

    with open(image_path, "rb") as f:
        img_bytes = f.read()

    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_text(
                text=SYSTEM_PROMPT + "\nAnalyze this image and return JSON only."
            ),
            types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
        ],
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return json.loads(response.text)


def combine_severity(user_sev: str, ai_sev: str) -> str:
    """Blend user severity (40%) with AI severity (60%) — from server.py:304-307."""
    s = {"Low": 1, "Medium": 2, "High": 3}
    lbl = {1: "Low", 2: "Medium", 3: "High"}
    return lbl[max(1, min(3, round(0.4 * s[user_sev] + 0.6 * s[ai_sev])))]


def run_ai_check(image_path: str, user_service: str = "Ambulance") -> dict:
    """Full analysis with mismatch detection — from server.py:269-301."""
    data = analyze_image(image_path)

    rec = data.get("recommended_services", [user_service])
    rec = [r for r in rec if r in ("Ambulance", "Fire", "Police")] or [user_service]

    incident_type = str(data.get("incident_type", "")).lower()
    if any(kw in incident_type for kw in ["traffic", "road", "vehicle", "car", "accident", "crash"]):
        if "Police" not in rec:
            rec.append("Police")

    sev = data.get("ai_severity", "Medium")
    if sev not in ("Low", "Medium", "High"):
        sev = "Medium"

    mismatch = None
    if user_service not in rec:
        mismatch = f"MISMATCH: AI recommends {', '.join(rec)} but user selected {user_service}."

    return {
        "incident_type": str(data.get("incident_type", "Other")),
        "confidence": float(data.get("confidence", 0.6)),
        "ai_severity": sev,
        "recommended_services": rec,
        "reasoning": str(data.get("reasoning", "")),
        "mismatch_warning": mismatch,
    }


# ============================================================
# MAIN — Run this in Google Colab
# ============================================================
if __name__ == "__main__":
    print("=" * 60)
    print("Urban Intel — AI Image Analysis")
    print("=" * 60)

    if GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        print("\n⚠️  Please set your GEMINI_API_KEY in the script.")
        print("   Get one free at: https://aistudio.google.com/apikey")
    else:
        print("\nUpload one or more images to analyze...")
        uploaded = files.upload()

        for filename in uploaded.keys():
            print(f"\n{'─' * 60}")
            print(f"📷 Analyzing: {filename}")
            print('─' * 60)

            result = run_ai_check(filename, user_service="Ambulance")
            print(json.dumps(result, indent=2))

            combined = combine_severity("Medium", result["ai_severity"])
            print(f"\n📊 Combined severity (user=Medium + AI): {combined}")
