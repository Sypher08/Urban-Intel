"""
Urban Intel — FastAPI backend
Data store: Supabase (Postgres) via service-role key (bypasses RLS).
Auth: JWT (HS256) + bcrypt — managed entirely by this backend.
AI: Gemini 3 Flash. Picks the first of:  GEMINI_API_KEY  >  EMERGENT_LLM_KEY  >  rule-based fallback.
"""
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import re
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timedelta, timezone
import jwt
import bcrypt

from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------- Config ----------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXP_DAYS = int(os.environ.get("JWT_EXP_DAYS", "7"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in /app/backend/.env")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Urban Intel API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()
log = logging.getLogger("urban-intel")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")

# ---------- Models ----------
Role = Literal["citizen", "agency", "admin"]
Severity = Literal["Low", "Medium", "High"]
Service = Literal["Ambulance", "Fire", "Police"]
Status = Literal["New", "Acknowledged", "EnRoute", "OnScene", "Resolved"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None
    role: Role = "citizen"
    agency_type: Optional[Service] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    phone: Optional[str] = None
    role: Role
    agency_type: Optional[Service] = None
    reputation: int = 0


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class IncidentCreate(BaseModel):
    description: str
    severity: Severity
    service: Service
    latitude: float
    longitude: float
    address: Optional[str] = None
    image_base64: Optional[str] = None
    is_sos: bool = False


class AIAnalysis(BaseModel):
    incident_type: str
    confidence: float
    ai_severity: Severity
    recommended_services: List[Service]
    reasoning: str
    mismatch_warning: Optional[str] = None


class Incident(BaseModel):
    id: str
    citizen_id: str
    citizen_name: str
    citizen_phone: Optional[str] = None
    description: str
    severity: Severity
    final_severity: Severity
    service: Service
    recommended_services: List[Service] = []
    latitude: float
    longitude: float
    address: Optional[str] = None
    image_base64: Optional[str] = None
    is_sos: bool = False
    status: Status = "New"
    ai_analysis: Optional[AIAnalysis] = None
    assigned_agency_id: Optional[str] = None
    eta_minutes: Optional[int] = None
    responder_vehicle: Optional[str] = None
    last_position: Optional[dict] = None
    track: List[dict] = []
    created_at: str
    updated_at: str


class IncidentStatusUpdate(BaseModel):
    status: Status
    eta_minutes: Optional[int] = None
    responder_vehicle: Optional[str] = None


class LocationPing(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None


# ---------- Async wrappers (supabase-py is sync) ----------
async def sb_run(fn, *args, **kwargs):
    return await asyncio.to_thread(fn, *args, **kwargs)


# ---------- Auth helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id, "email": email, "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=JWT_EXP_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def to_public(row: dict) -> UserPublic:
    return UserPublic(
        id=row["id"], email=row["email"], name=row["name"],
        phone=row.get("phone"), role=row["role"],
        agency_type=row.get("agency_type"), reputation=row.get("reputation", 0),
    )


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> UserPublic:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    res = await sb_run(lambda: sb.table("users").select("*").eq("id", payload["sub"]).limit(1).execute())
    if not res.data:
        raise HTTPException(401, "User not found")
    return to_public(res.data[0])


def require_roles(*roles: Role):
    async def _dep(user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if user.role not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return _dep


# ---------- AI ----------
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


def _strip_b64(b64: str) -> str:
    return re.sub(r"^data:image/[a-zA-Z]+;base64,", "", b64)


async def _ai_via_google(image_b64: str) -> Optional[dict]:
    """Direct Google Gemini API — works on any machine, requires GEMINI_API_KEY."""
    if not GEMINI_API_KEY:
        return None
    try:
        from google import genai
        from google.genai import types
        import base64 as _b64
        client = genai.Client(api_key=GEMINI_API_KEY)
        img_bytes = _b64.b64decode(_strip_b64(image_b64))
        def _call():
            return client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_text(text=SYSTEM_PROMPT + "\nAnalyze this image and return JSON only."),
                    types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                ],
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
        resp = await asyncio.to_thread(_call)
        return json.loads(resp.text)
    except Exception as e:
        log.warning("Google Gemini direct call failed: %s", e)
        return None


async def _ai_via_emergent(image_b64: str) -> Optional[dict]:
    """Emergent gateway (preview only)."""
    if not EMERGENT_LLM_KEY:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"triage-{uuid.uuid4()}",
            system_message=SYSTEM_PROMPT,
        ).with_model("gemini", "gemini-3-flash-preview")
        msg = UserMessage(
            text="Analyze this incident photo and return the JSON.",
            file_contents=[ImageContent(image_base64=_strip_b64(image_b64))],
        )
        raw = await chat.send_message(msg)
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        return json.loads(match.group(0) if match else raw)
    except Exception as e:
        log.warning("Emergent gateway call failed: %s", e)
        return None


async def analyze_incident_image(image_base64: str, user_service: Service) -> AIAnalysis:
    data = await _ai_via_google(image_base64)
    if data is None:
        data = await _ai_via_emergent(image_base64)
    if data is None:
        # Rule-based fallback so demos never break
        return AIAnalysis(
            incident_type="Other", confidence=0.5, ai_severity="Medium",
            recommended_services=[user_service],
            reasoning="AI unavailable — using user input.",
        )

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
        mismatch = f"Possible mismatch: AI recommends {', '.join(rec)} but user selected {user_service}."

    return AIAnalysis(
        incident_type=str(data.get("incident_type", "Other")),
        confidence=float(data.get("confidence", 0.6)),
        ai_severity=sev,
        recommended_services=rec,
        reasoning=str(data.get("reasoning", "")),
        mismatch_warning=mismatch,
    )


def combine_severity(user_sev: Severity, ai_sev: Severity) -> Severity:
    s = {"Low": 1, "Medium": 2, "High": 3}
    lbl = {1: "Low", 2: "Medium", 3: "High"}
    return lbl[max(1, min(3, round(0.4 * s[user_sev] + 0.6 * s[ai_sev])))]


# =================== ROUTES ===================
# ---------- Auth ----------
@api_router.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(payload: UserCreate):
    email = payload.email.lower().strip()
    try:
        existing = await sb_run(lambda: sb.table("users").select("id").eq("email", email).limit(1).execute())
    except Exception as e:
        msg = str(e)
        if "PGRST205" in msg or "schema cache" in msg or "Could not find the table" in msg:
            raise HTTPException(503, "Database not initialized. Please open the Supabase SQL editor and run /app/backend/supabase_setup.sql once, then try again.")
        raise HTTPException(500, f"Database error: {msg[:160]}")
    if existing.data:
        raise HTTPException(400, "An account with this email already exists. Please sign in instead.")
    user_id = str(uuid.uuid4())
    row = {
        "id": user_id, "email": email, "name": payload.name.strip(),
        "phone": (payload.phone or "").strip() or None,
        "role": payload.role, "agency_type": payload.agency_type,
        "reputation": 0, "hashed_password": hash_password(payload.password),
    }
    try:
        await sb_run(lambda: sb.table("users").insert(row).execute())
    except Exception as e:
        log.exception("Supabase insert failed")
        msg = str(e)
        if "PGRST205" in msg or "schema cache" in msg or "Could not find the table" in msg:
            raise HTTPException(503, "Database not initialized. Please run supabase_setup.sql in the Supabase dashboard once, then try again.")
        raise HTTPException(500, f"Could not save user: {msg[:160]}")
    token = create_token(user_id, email, payload.role)
    return TokenResponse(access_token=token, user=to_public(row))


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    email = payload.email.lower().strip()
    try:
        res = await sb_run(lambda: sb.table("users").select("*").eq("email", email).limit(1).execute())
    except Exception as e:
        msg = str(e)
        if "PGRST205" in msg or "schema cache" in msg:
            raise HTTPException(503, "Database not initialized. Run supabase_setup.sql in the Supabase dashboard once.")
        raise HTTPException(500, f"Login failed: {msg[:160]}")
    if not res.data:
        raise HTTPException(401, "Invalid email or password")
    user = res.data[0]
    if not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid email or password")
    return TokenResponse(access_token=create_token(user["id"], user["email"], user["role"]),
                         user=to_public(user))


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user: UserPublic = Depends(get_current_user)):
    return user


# ---------- Incidents ----------
@api_router.post("/incidents/analyze", response_model=AIAnalysis)
async def analyze(payload: dict, user: UserPublic = Depends(get_current_user)):
    image_b64 = payload.get("image_base64")
    user_service = payload.get("service", "Ambulance")
    if not image_b64:
        raise HTTPException(400, "image_base64 required")
    return await analyze_incident_image(image_b64, user_service)


@api_router.post("/incidents", response_model=Incident, status_code=201)
async def create_incident(payload: IncidentCreate, user: UserPublic = Depends(get_current_user)):
    incident_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    ai: Optional[AIAnalysis] = None
    if payload.image_base64 and not payload.is_sos:
        ai = await analyze_incident_image(payload.image_base64, payload.service)

    final_sev = combine_severity(payload.severity, ai.ai_severity) if ai else payload.severity
    recommended = ai.recommended_services if ai else [payload.service]

    row = {
        "id": incident_id, "citizen_id": user.id, "citizen_name": user.name,
        "citizen_phone": user.phone, "description": payload.description,
        "severity": payload.severity, "final_severity": final_sev,
        "service": payload.service, "recommended_services": recommended,
        "latitude": payload.latitude, "longitude": payload.longitude,
        "address": payload.address, "image_base64": payload.image_base64,
        "is_sos": payload.is_sos, "status": "New",
        "ai_analysis": ai.model_dump() if ai else None,
        "track": [], "created_at": now_iso, "updated_at": now_iso,
    }
    await sb_run(lambda: sb.table("incidents").insert(row).execute())
    # bump reputation
    new_rep = (user.reputation or 0) + 1
    await sb_run(lambda: sb.table("users").update({"reputation": new_rep}).eq("id", user.id).execute())
    return Incident(**row)


@api_router.get("/incidents/mine", response_model=List[Incident])
async def my_incidents(user: UserPublic = Depends(get_current_user)):
    res = await sb_run(lambda: sb.table("incidents").select("*").eq("citizen_id", user.id).order("created_at", desc=True).limit(200).execute())
    return [Incident(**d) for d in (res.data or [])]


@api_router.get("/incidents/{incident_id}", response_model=Incident)
async def get_incident(incident_id: str, user: UserPublic = Depends(get_current_user)):
    res = await sb_run(lambda: sb.table("incidents").select("*").eq("id", incident_id).limit(1).execute())
    if not res.data:
        raise HTTPException(404, "Incident not found")
    doc = res.data[0]
    if user.role == "citizen" and doc["citizen_id"] != user.id:
        raise HTTPException(403, "Forbidden")
    return Incident(**doc)


@api_router.get("/incidents", response_model=List[Incident])
async def list_incidents(
    status_filter: Optional[Status] = None,
    user: UserPublic = Depends(require_roles("agency", "admin")),
):
    def _q():
        q = sb.table("incidents").select("*")
        if status_filter:
            q = q.eq("status", status_filter)
        if user.role == "agency" and user.agency_type:
            q = q.filter("recommended_services", "cs", json.dumps([user.agency_type]))
        return q.order("created_at", desc=True).limit(500).execute()
    res = await sb_run(_q)
    return [Incident(**d) for d in (res.data or [])]


@api_router.patch("/incidents/{incident_id}/status", response_model=Incident)
async def update_status(
    incident_id: str,
    payload: IncidentStatusUpdate,
    user: UserPublic = Depends(require_roles("agency", "admin")),
):
    update = {
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "assigned_agency_id": user.id,
    }
    if payload.eta_minutes is not None:
        update["eta_minutes"] = payload.eta_minutes
    if payload.responder_vehicle is not None:
        update["responder_vehicle"] = payload.responder_vehicle
    res = await sb_run(lambda: sb.table("incidents").update(update).eq("id", incident_id).execute())
    if not res.data:
        raise HTTPException(404, "Incident not found")
    return Incident(**res.data[0])


# ---------- Tracking ----------
@api_router.post("/incidents/{incident_id}/track")
async def push_location(incident_id: str, payload: LocationPing, user: UserPublic = Depends(get_current_user)):
    res = await sb_run(lambda: sb.table("incidents").select("citizen_id,track").eq("id", incident_id).limit(1).execute())
    if not res.data:
        raise HTTPException(404, "Incident not found")
    doc = res.data[0]
    if user.role == "citizen" and doc["citizen_id"] != user.id:
        raise HTTPException(403, "Forbidden")
    point = {
        "lat": payload.latitude, "lng": payload.longitude,
        "accuracy": payload.accuracy,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    track = (doc.get("track") or [])[-99:] + [point]
    await sb_run(lambda: sb.table("incidents").update({"track": track, "last_position": point}).eq("id", incident_id).execute())
    return {"ok": True, "point": point}


@api_router.get("/incidents/{incident_id}/track")
async def get_track(incident_id: str, user: UserPublic = Depends(get_current_user)):
    res = await sb_run(lambda: sb.table("incidents").select("citizen_id,track,last_position,latitude,longitude").eq("id", incident_id).limit(1).execute())
    if not res.data:
        raise HTTPException(404, "Incident not found")
    doc = res.data[0]
    if user.role == "citizen" and doc["citizen_id"] != user.id:
        raise HTTPException(403, "Forbidden")
    return {
        "origin": {"lat": doc["latitude"], "lng": doc["longitude"]},
        "last_position": doc.get("last_position"),
        "track": doc.get("track") or [],
    }


# ---------- Admin ----------
@api_router.get("/admin/analytics")
async def analytics(user: UserPublic = Depends(require_roles("admin", "agency"))):
    res = await sb_run(lambda: sb.table("incidents").select("id,status,final_severity,recommended_services,latitude,longitude").execute())
    rows = res.data or []
    by_sev = {"Low": 0, "Medium": 0, "High": 0}
    by_svc = {"Ambulance": 0, "Fire": 0, "Police": 0}
    active = resolved = 0
    for r in rows:
        by_sev[r["final_severity"]] = by_sev.get(r["final_severity"], 0) + 1
        for s in (r.get("recommended_services") or []):
            if s in by_svc:
                by_svc[s] += 1
        if r["status"] == "Resolved":
            resolved += 1
        else:
            active += 1
    return {
        "total": len(rows), "active": active, "resolved": resolved,
        "by_severity": by_sev, "by_service": by_svc,
        "hotspots": rows[-100:],
    }


@api_router.get("/admin/db-overview")
async def db_overview(user: UserPublic = Depends(require_roles("admin"))):
    out = {}
    for name in ["users", "incidents"]:
        if name == "users":
            recent = await sb_run(lambda: sb.table("users").select("id,email,name,phone,role,agency_type,reputation,created_at").order("created_at", desc=True).limit(20).execute())
        else:
            recent = await sb_run(lambda: sb.table("incidents").select("id,citizen_name,description,final_severity,status,recommended_services,latitude,longitude,ai_analysis,created_at").order("created_at", desc=True).limit(20).execute())
        # count: do a separate head request
        count_res = await sb_run(lambda: sb.table(name).select("id", count="exact").limit(1).execute())
        out[name] = {"count": count_res.count or 0, "recent": recent.data or []}
    return out


@api_router.get("/admin/users")
async def list_users(user: UserPublic = Depends(require_roles("admin"))):
    res = await sb_run(lambda: sb.table("users").select("id,email,name,phone,role,agency_type,reputation,created_at").execute())
    return res.data or []


# ---------- Docs ----------
@api_router.get("/project-info", response_class=HTMLResponse)
async def project_info():
    path = ROOT_DIR / "static" / "project.html"
    if path.exists():
        return FileResponse(str(path), media_type="text/html")
    return HTMLResponse("<h1>Project info page missing</h1>", status_code=404)


@api_router.get("/app", response_class=HTMLResponse)
async def web_app():
    path = ROOT_DIR / "static" / "app.html"
    if path.exists():
        return FileResponse(str(path), media_type="text/html")
    return HTMLResponse("<h1>App page missing</h1>", status_code=404)


@api_router.get("/health")
async def health():
    try:
        await sb_run(lambda: sb.table("users").select("id").limit(1).execute())
        sb_ok = True
    except Exception:
        sb_ok = False
    return {"status": "ok", "supabase": sb_ok,
            "ai": "google-direct" if GEMINI_API_KEY else ("emergent" if EMERGENT_LLM_KEY else "fallback")}


@api_router.get("/")
async def root():
    return {"app": "Urban Intel", "status": "ok", "docs": "/api/project-info"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed_demo_users():
    """Idempotently seed 5 demo accounts. If Supabase tables don't exist, log a CLEAR error."""
    try:
        await sb_run(lambda: sb.table("users").select("id").limit(1).execute())
    except Exception as e:
        log.error("=" * 72)
        log.error("Supabase tables not found. Run /app/backend/supabase_setup.sql once in your")
        log.error("Supabase dashboard (SQL Editor → New query → paste → Run). Details: %s", e)
        log.error("=" * 72)
        return

    seeds = [
        {"email": "admin@urbanintel.app", "password": "Admin@123", "name": "City Admin", "role": "admin", "phone": "+1-555-0100"},
        {"email": "fire@urbanintel.app", "password": "Fire@123", "name": "Fire Dispatch", "role": "agency", "agency_type": "Fire", "phone": "+1-555-0101"},
        {"email": "medical@urbanintel.app", "password": "Medical@123", "name": "Medical Dispatch", "role": "agency", "agency_type": "Ambulance", "phone": "+1-555-0102"},
        {"email": "police@urbanintel.app", "password": "Police@123", "name": "Police Dispatch", "role": "agency", "agency_type": "Police", "phone": "+1-555-0103"},
        {"email": "citizen@urbanintel.app", "password": "Citizen@123", "name": "Demo Citizen", "role": "citizen", "phone": "+1-555-0200"},
    ]
    for s in seeds:
        exists = await sb_run(lambda s=s: sb.table("users").select("id").eq("email", s["email"]).limit(1).execute())
        if exists.data:
            continue
        row = {
            "id": str(uuid.uuid4()),
            "email": s["email"], "name": s["name"], "role": s["role"],
            "agency_type": s.get("agency_type"), "phone": s.get("phone"),
            "reputation": 0, "hashed_password": hash_password(s["password"]),
        }
        try:
            await sb_run(lambda row=row: sb.table("users").insert(row).execute())
            log.info("Seeded demo user: %s", s["email"])
        except Exception as e:
            log.warning("Failed to seed %s: %s", s["email"], e)
