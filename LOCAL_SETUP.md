# Urban Intel — Local Setup Guide (PhD Demo Edition)

This guide gets the app running on your laptop in under 5 minutes, with no dependency on the Emergent preview environment. Everything runs locally except the database (Supabase cloud) and AI (Google Gemini).

## 0. One-time Supabase setup (REQUIRED — do this FIRST)

The backend stores all data in your Supabase project (`https://rzyliopxrugdzbmjzgsh.supabase.co`). The tables must exist before the backend can seed users or accept registrations.

1. Open **https://supabase.com/dashboard/project/rzyliopxrugdzbmjzgsh/sql/new**
2. Copy the entire contents of **`backend/supabase_setup.sql`** and paste into the editor.
3. Click **Run**. You should see "Success. No rows returned."
4. (Verify) Go to **Table Editor** → you should now see `users` and `incidents` tables.

> If you skip this, every registration request will fail with "table not found". The backend logs make this very clear.

## 1. Prerequisites

| Tool | Version | macOS install | Ubuntu/WSL | Windows |
|---|---|---|---|---|
| Python | ≥3.10 | `brew install python@3.11` | `apt install python3.11 python3.11-venv` | python.org installer |
| Node.js | ≥18 | `brew install node` | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt install nodejs` | nodejs.org installer |
| Yarn | classic 1.x | `npm i -g yarn` | `npm i -g yarn` | `npm i -g yarn` |

## 2. Backend (FastAPI) — terminal 1

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# .env is already filled in with Supabase + JWT keys; only AI key is optional
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

You should see:
```
INFO  Seeded demo user: admin@urbanintel.app
INFO  Seeded demo user: fire@urbanintel.app
...
INFO  Uvicorn running on http://0.0.0.0:8001
```

Verify:
```bash
curl http://localhost:8001/api/health
# {"status":"ok","supabase":true,"ai":"emergent"}
```

## 3. AI — pick ONE of these (recommended for the demo: option A)

The backend selects, in order: **GEMINI_API_KEY → EMERGENT_LLM_KEY → rule-based fallback**.

### A. Direct Google Gemini (works anywhere, no Emergent dependency) — RECOMMENDED for live demo
1. Go to **https://aistudio.google.com/apikey** → create an API key (free tier is fine for a demo).
2. Open `backend/.env` and set:
   ```
   GEMINI_API_KEY=AIza...your-key...
   ```
3. Restart the backend. `curl /api/health` should now show `"ai":"google-direct"`.

### B. Emergent gateway (preview only)
Already pre-filled; works while Emergent's preview environment is running. Will not work after Emergent shuts down. **Do not rely on this for the in-person demo.**

### C. No key set
App still works end-to-end — every report submits, AI just returns "Other / Medium / [user's pick]". Useful if you have no internet.

## 4. Frontend (Expo) — terminal 2

```bash
cd frontend
# point Expo at the local backend
echo "EXPO_PUBLIC_BACKEND_URL=http://localhost:8001" > .env.local
yarn install
yarn web              # runs on http://localhost:8081 (open in any browser)
# OR
yarn ios              # iOS simulator (requires Xcode)
yarn android          # Android emulator (requires Android Studio)
```

To present on a phone in the room, run `yarn start` and scan the QR code with the **Expo Go** app. The phone must be on the same Wi-Fi as your laptop. Update `.env.local` to use your laptop's LAN IP:
```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.42:8001     # ← your laptop IP
```

## 5. One-command demo runner (optional)

`./run-local.sh` (provided at repo root) starts backend and frontend together. Press `Ctrl+C` to stop both.

## 6. Demo accounts (auto-seeded on backend startup)

| Email | Password | Role |
|---|---|---|
| `admin@urbanintel.app` | `Admin@123` | admin |
| `fire@urbanintel.app` | `Fire@123` | agency (Fire) |
| `medical@urbanintel.app` | `Medical@123` | agency (Ambulance) |
| `police@urbanintel.app` | `Police@123` | agency (Police) |
| `citizen@urbanintel.app` | `Citizen@123` | citizen |

Anyone can also self-register at the **Create account** screen — choose role + agency type + optional phone number.

## 7. Demo script (3-minute live walk-through)

1. **Open `/` → tap *Citizen* demo chip → Sign In.**
2. **Tap *Report Incident*** → pick a photo (use any sample fire/accident image from `demo-images/`) → tap **Run AI Triage** → show the Gemini classification card. Submit.
3. **Sign out → log in as `admin@urbanintel.app`.**
4. In the **Dispatch Console**, point out the AI badge on the new incident, open it → show the AI block + live-track section → tap **Advance** to move status forward.
5. Tap the **server icon** (top-right) → **Database Overview** → tap the dossier banner → opens `/api/project-info` with the full architecture, API table, and **per-class precision/recall/F1 metrics**.
6. Open the Supabase **Table Editor** in another tab → show the same row appearing in the live `incidents` table.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `register HTTP 400 — table not found` | step 0 skipped | Run `supabase_setup.sql` in Supabase dashboard. |
| `AI: fallback` in health | no key set | Add `GEMINI_API_KEY` to `backend/.env` and restart. |
| Expo web shows blank screen | `EXPO_PUBLIC_BACKEND_URL` wrong | Fix in `frontend/.env.local`, then `Ctrl+C` and `yarn web` again. |
| "Email already registered" | account exists | Sign in instead, or delete the row in Supabase → `users` table. |

## 9. What's NOT in this build (and why)

- **Background location while app is closed** — requires an iOS/Android development build (`eas build`) + foreground service permission. Expo Go cannot run background tasks. The in-app "Share live location" button works while the citizen detail screen is open.
- **Push notifications to dispatch** — requires Firebase Cloud Messaging + a dev build. The dispatch console polls every 10 s, so it feels real-time in the demo.
