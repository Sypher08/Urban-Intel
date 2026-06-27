# Urban Intel — Emergency Response Platform

AI-powered emergency response: citizens report incidents with photo + GPS, Gemini classifies the incident and severity, dispatch console routes Ambulance / Fire / Police in real time.

- **Frontend:** Expo SDK 54 (iOS · Android · Web) · expo-router
- **Backend:** FastAPI + Supabase (Postgres) · JWT auth (HS256 + bcrypt)
- **AI:** Google Gemini Vision (direct API or via Emergent gateway, both supported; graceful fallback)

## Quickstart

1. **Run the one-time Supabase setup**: paste `backend/supabase_setup.sql` into the Supabase SQL editor and click Run.
2. **Local launch:** `./run-local.sh` (or follow `LOCAL_SETUP.md`).
3. Open `http://localhost:8081`.
4. Demo accounts auto-seed on backend startup (see `memory/test_credentials.md`).

Full guide: **[LOCAL_SETUP.md](./LOCAL_SETUP.md)** · Project dossier (after backend is up): **http://localhost:8001/api/project-info**
