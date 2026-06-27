#!/usr/bin/env bash
# Urban Intel — one-command local launcher
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "▶  Starting Urban Intel locally…"
echo

# --- Backend ---
if [ ! -d "backend/.venv" ]; then
  echo "Creating Python venv…"
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
(
  cd backend
  source .venv/bin/activate
  echo "▶  FastAPI on http://localhost:8001"
  uvicorn server:app --host 0.0.0.0 --port 8001 --reload &
  echo $! > /tmp/urban_intel_backend.pid
)

# --- Frontend ---
if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend deps…"
  (cd frontend && yarn install --silent)
fi
[ -f frontend/.env.local ] || echo "EXPO_PUBLIC_BACKEND_URL=http://localhost:8001" > frontend/.env.local

(
  cd frontend
  echo "▶  Expo (web) on http://localhost:8081"
  yarn web &
  echo $! > /tmp/urban_intel_frontend.pid
)

cleanup() {
  echo
  echo "Stopping…"
  kill "$(cat /tmp/urban_intel_backend.pid)"  2>/dev/null || true
  kill "$(cat /tmp/urban_intel_frontend.pid)" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM
wait
