import os
import base64
import io
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ['EXPO_BACKEND_URL'].rstrip('/')


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def citizen_auth(api):
    return _login(api, "citizen@urbanintel.app", "Citizen@123")


@pytest.fixture(scope="session")
def admin_auth(api):
    return _login(api, "admin@urbanintel.app", "Admin@123")


@pytest.fixture(scope="session")
def fire_auth(api):
    return _login(api, "fire@urbanintel.app", "Fire@123")


@pytest.fixture(scope="session")
def fire_image_b64():
    """Create a realistic-looking 'fire/smoke' JPEG with strong visual features."""
    img = Image.new("RGB", (512, 384), (20, 18, 25))
    d = ImageDraw.Draw(img)
    # building silhouette
    d.rectangle([60, 200, 460, 360], fill=(40, 40, 50))
    for x in range(80, 460, 60):
        for y in range(220, 340, 50):
            d.rectangle([x, y, x + 35, y + 28], fill=(180, 140, 30))
    # flames
    for i, c in enumerate([(255, 80, 0), (255, 160, 0), (255, 220, 60)]):
        d.polygon([(180 + i*40, 200), (220 + i*40, 80 - i*10),
                   (260 + i*40, 200)], fill=c)
    # smoke plume
    for r in range(60, 0, -8):
        d.ellipse([200 - r, 30 - r, 200 + r, 30 + r],
                  fill=(90 + r, 90 + r, 90 + r))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")
