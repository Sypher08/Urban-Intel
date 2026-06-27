# Urban Intel — Emergency Response Platform (PRD)

## What it is
A full-stack Expo React Native + FastAPI + MongoDB platform where citizens report emergencies with photo + GPS, an AI (Gemini 3 Flash vision) classifies the incident & severity and recommends services, and agencies/admins respond from a real-time Dispatch Console.

## Stack
- **Frontend:** Expo SDK 54 (iOS · Android · Web via Metro). expo-router file-based routing.
- **Backend:** FastAPI + Motor (async MongoDB). JWT (HS256) + bcrypt auth.
- **AI:** Gemini 3 Flash Preview via `emergentintegrations` (Emergent LLM key).
- **Storage:** MongoDB collections `users` + `incidents` (UUID string ids; `_id` never returned).

## Roles & Demo Accounts (auto-seeded)
| Role | Email | Password |
|---|---|---|
| admin | admin@urbanintel.app | Admin@123 |
| agency (Fire) | fire@urbanintel.app | Fire@123 |
| agency (Ambulance) | medical@urbanintel.app | Medical@123 |
| agency (Police) | police@urbanintel.app | Police@123 |
| citizen | citizen@urbanintel.app | Citizen@123 |

Anyone can self-register at `/auth/register` choosing any role.

## Core Features
- **Citizen:** SOS button (pulse + 1-tap), report wizard (camera/gallery + GPS + AI triage button), severity (Low/Med/High), service picker, My Reports, response timeline, **live location sharing** to dispatch.
- **AI Triage:** Sends base64 image to Gemini 3 Flash, parses JSON → incident_type · confidence · ai_severity · recommended_services · reasoning · mismatch_warning vs user pick. Severity fused 40% user + 60% AI.
- **Dispatch Console (agency + admin):** auto-refreshes every 10s, analytics cards, status filters (sticky horizontal chip row), per-incident AI triage panel, **live citizen track** (origin · last ping · count · open-in-map), status advance with auto-generated ETA + vehicle.
- **Admin-only:**
  - `/db-admin` screen → GET `/api/admin/db-overview` showing every collection + 20 most-recent docs (password hashes hidden).
  - `/api/admin/users` full user list.
  - `/api/project-info` HTML dossier with architecture, file map, API table, AI accuracy report (precision/recall/F1), CNN training code (MobileNetV2) and LLM benchmark script.

## Backend API
All under `/api/*`:
- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Incidents: `POST /incidents/analyze`, `POST /incidents`, `GET /incidents/mine`, `GET /incidents/{id}`, `GET /incidents` (role-gated), `PATCH /incidents/{id}/status`
- Tracking: `POST /incidents/{id}/track`, `GET /incidents/{id}/track`
- Admin: `GET /admin/analytics`, `GET /admin/db-overview`, `GET /admin/users`
- Docs: `GET /project-info` (HTML)

## Frontend Routes
- `/auth/login`, `/auth/register`
- `/(citizen)/home`, `/(citizen)/report`, `/(citizen)/my-reports`, `/(citizen)/incident/[id]`
- `/(agency)/dashboard`, `/(agency)/db-admin`

## 24×7 Reliability
- Supervisord keeps `backend` (FastAPI/Uvicorn) and `expo` running.
- MongoDB queries are async (Motor); AI failures gracefully fall back so reports always submit.
- Citizen detail screen polls every 15s; Dispatch Console polls every 10s.
