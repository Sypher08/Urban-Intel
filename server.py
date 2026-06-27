"""Compatibility entrypoint for running the FastAPI backend from the repo root.

This lets local commands such as `python -m uvicorn server:app` import the
application while keeping the real implementation in `backend/server.py`.
"""

from backend.server import app

__all__ = ["app"]
