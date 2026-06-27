"""Urban Intel backend API tests covering auth, incidents, RBAC, AI, analytics."""
import uuid


# ---- Auth ----
class TestAuth:
    def test_register_citizen(self, api, base_url):
        email = f"TEST_{uuid.uuid4().hex[:8]}@urbanintel.app"
        r = api.post(f"{base_url}/api/auth/register",
                     json={"email": email, "password": "Pass@123", "name": "Test User"})
        assert r.status_code == 201, r.text
        body = r.json()
        assert "access_token" in body and body["token_type"] == "bearer"
        assert body["user"]["role"] == "citizen"
        assert body["user"]["email"] == email
        assert "id" in body["user"]
        # verify via /me
        me = api.get(f"{base_url}/api/auth/me",
                     headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_register_duplicate(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/register",
                     json={"email": "citizen@urbanintel.app",
                           "password": "Citizen@123", "name": "Dup"})
        assert r.status_code == 400

    def test_login_seeded_citizen(self, citizen_auth):
        assert citizen_auth["user"]["role"] == "citizen"
        assert citizen_auth["user"]["email"] == "citizen@urbanintel.app"

    def test_login_seeded_admin(self, admin_auth):
        assert admin_auth["user"]["role"] == "admin"

    def test_login_seeded_fire(self, fire_auth):
        assert fire_auth["user"]["role"] == "agency"
        assert fire_auth["user"]["agency_type"] == "Fire"

    def test_login_invalid(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/login",
                     json={"email": "citizen@urbanintel.app", "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_token(self, api, base_url):
        r = requests_get(api, f"{base_url}/api/auth/me")
        assert r.status_code in (401, 403)


def requests_get(api, url, **kw):
    return api.get(url, **kw)


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---- AI Analyze ----
class TestAIAnalyze:
    def test_analyze_requires_image(self, api, base_url, citizen_auth):
        r = api.post(f"{base_url}/api/incidents/analyze",
                     headers=hdr(citizen_auth["access_token"]),
                     json={"service": "Fire"})
        assert r.status_code == 400

    def test_analyze_returns_shape(self, api, base_url, citizen_auth, fire_image_b64):
        r = api.post(f"{base_url}/api/incidents/analyze",
                     headers=hdr(citizen_auth["access_token"]),
                     json={"image_base64": fire_image_b64, "service": "Fire"},
                     timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["incident_type"] in (
            "Fire", "Accident", "Medical", "Crime", "Flood", "Disaster", "Other")
        assert body["ai_severity"] in ("Low", "Medium", "High")
        assert isinstance(body["recommended_services"], list)
        assert len(body["recommended_services"]) >= 1
        for s in body["recommended_services"]:
            assert s in ("Ambulance", "Fire", "Police")
        assert 0.0 <= body["confidence"] <= 1.0


# ---- Incidents CRUD & RBAC ----
class TestIncidents:
    def test_create_without_image(self, api, base_url, citizen_auth):
        r = api.post(f"{base_url}/api/incidents",
                     headers=hdr(citizen_auth["access_token"]),
                     json={"description": "TEST minor incident",
                           "severity": "Low", "service": "Police",
                           "latitude": 12.97, "longitude": 77.59})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["status"] == "New"
        assert body["final_severity"] == "Low"
        assert body["recommended_services"] == ["Police"]
        assert body["ai_analysis"] is None
        assert "_id" not in body
        # persisted -> GET
        gid = body["id"]
        g = api.get(f"{base_url}/api/incidents/{gid}",
                    headers=hdr(citizen_auth["access_token"]))
        assert g.status_code == 200
        assert g.json()["id"] == gid

    def test_create_with_image_runs_ai(self, api, base_url, citizen_auth,
                                       fire_image_b64):
        r = api.post(f"{base_url}/api/incidents",
                     headers=hdr(citizen_auth["access_token"]),
                     json={"description": "TEST fire with image",
                           "severity": "Medium", "service": "Fire",
                           "latitude": 12.97, "longitude": 77.59,
                           "image_base64": fire_image_b64},
                     timeout=120)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["ai_analysis"] is not None
        assert body["final_severity"] in ("Low", "Medium", "High")
        assert len(body["recommended_services"]) >= 1
        assert "_id" not in body

    def test_mine_returns_only_own(self, api, base_url, citizen_auth):
        r = api.get(f"{base_url}/api/incidents/mine",
                    headers=hdr(citizen_auth["access_token"]))
        assert r.status_code == 200
        uid = citizen_auth["user"]["id"]
        for inc in r.json():
            assert inc["citizen_id"] == uid

    def test_citizen_cannot_list_all(self, api, base_url, citizen_auth):
        r = api.get(f"{base_url}/api/incidents",
                    headers=hdr(citizen_auth["access_token"]))
        assert r.status_code == 403

    def test_admin_can_list(self, api, base_url, admin_auth):
        r = api.get(f"{base_url}/api/incidents",
                    headers=hdr(admin_auth["access_token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_status_filter_works(self, api, base_url, admin_auth):
        r = api.get(f"{base_url}/api/incidents?status_filter=New",
                    headers=hdr(admin_auth["access_token"]))
        assert r.status_code == 200
        for inc in r.json():
            assert inc["status"] == "New"

    def test_agency_filtered_by_service(self, api, base_url, fire_auth,
                                       citizen_auth, fire_image_b64):
        # ensure at least one Fire-recommended incident exists
        api.post(f"{base_url}/api/incidents",
                 headers=hdr(citizen_auth["access_token"]),
                 json={"description": "TEST fire incident",
                       "severity": "High", "service": "Fire",
                       "latitude": 12.97, "longitude": 77.59})
        r = api.get(f"{base_url}/api/incidents",
                    headers=hdr(fire_auth["access_token"]))
        assert r.status_code == 200
        for inc in r.json():
            assert "Fire" in inc["recommended_services"]

    def test_citizen_cannot_access_others_incident(self, api, base_url,
                                                   admin_auth, citizen_auth):
        # create another citizen and incident
        email = f"TEST_{uuid.uuid4().hex[:8]}@urbanintel.app"
        reg = api.post(f"{base_url}/api/auth/register",
                       json={"email": email, "password": "Pass@123",
                             "name": "Other"}).json()
        inc = api.post(f"{base_url}/api/incidents",
                       headers=hdr(reg["access_token"]),
                       json={"description": "TEST other", "severity": "Low",
                             "service": "Police", "latitude": 1.0,
                             "longitude": 1.0}).json()
        # citizen tries to GET someone else's
        r = api.get(f"{base_url}/api/incidents/{inc['id']}",
                    headers=hdr(citizen_auth["access_token"]))
        assert r.status_code == 403
        # admin can access
        r2 = api.get(f"{base_url}/api/incidents/{inc['id']}",
                     headers=hdr(admin_auth["access_token"]))
        assert r2.status_code == 200

    def test_update_status_by_agency(self, api, base_url, fire_auth,
                                     citizen_auth):
        inc = api.post(f"{base_url}/api/incidents",
                       headers=hdr(citizen_auth["access_token"]),
                       json={"description": "TEST status update",
                             "severity": "Medium", "service": "Fire",
                             "latitude": 12.9, "longitude": 77.5}).json()
        r = api.patch(f"{base_url}/api/incidents/{inc['id']}/status",
                      headers=hdr(fire_auth["access_token"]),
                      json={"status": "EnRoute", "eta_minutes": 8,
                            "responder_vehicle": "Engine-12"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "EnRoute"
        assert body["eta_minutes"] == 8
        assert body["responder_vehicle"] == "Engine-12"
        # GET verifies persistence
        g = api.get(f"{base_url}/api/incidents/{inc['id']}",
                    headers=hdr(fire_auth["access_token"])).json()
        assert g["status"] == "EnRoute"

    def test_citizen_cannot_update_status(self, api, base_url, citizen_auth):
        inc = api.post(f"{base_url}/api/incidents",
                       headers=hdr(citizen_auth["access_token"]),
                       json={"description": "TEST", "severity": "Low",
                             "service": "Police", "latitude": 1.0,
                             "longitude": 1.0}).json()
        r = api.patch(f"{base_url}/api/incidents/{inc['id']}/status",
                      headers=hdr(citizen_auth["access_token"]),
                      json={"status": "Resolved"})
        assert r.status_code == 403

    def test_incident_404(self, api, base_url, admin_auth):
        r = api.get(f"{base_url}/api/incidents/does-not-exist",
                    headers=hdr(admin_auth["access_token"]))
        assert r.status_code == 404


# ---- Analytics & RBAC ----
class TestAnalytics:
    def test_admin_analytics(self, api, base_url, admin_auth):
        r = api.get(f"{base_url}/api/admin/analytics",
                    headers=hdr(admin_auth["access_token"]))
        assert r.status_code == 200
        body = r.json()
        for k in ("total", "active", "resolved", "by_severity",
                  "by_service", "hotspots"):
            assert k in body
        assert set(body["by_severity"].keys()) == {"Low", "Medium", "High"}
        assert set(body["by_service"].keys()) == {"Ambulance", "Fire", "Police"}
        assert isinstance(body["hotspots"], list)

    def test_citizen_cannot_access_analytics(self, api, base_url,
                                             citizen_auth):
        r = api.get(f"{base_url}/api/admin/analytics",
                    headers=hdr(citizen_auth["access_token"]))
        assert r.status_code == 403
