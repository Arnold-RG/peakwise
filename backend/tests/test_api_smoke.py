"""Smoke checks that the API boots and multipart uploads are parsed."""

from fastapi.testclient import TestClient

from backend.app.main import app

CAFFEINE_MGF = b"""BEGIN IONS
TITLE=Caffeine
PEPMASS=195.0877
ADDUCT=[M+H]+
138.0664 800
195.0877 1000
END IONS
"""


def test_ping():
    with TestClient(app) as client:
        response = client.get("/api/ping")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["project"] == "Peakwise"


def test_batch_rejects_disallowed_upload():
    with TestClient(app) as client:
        response = client.post(
            "/api/batch",
            files={"file": ("notes.exe", b"not a spectrum", "application/octet-stream")},
        )
    assert response.status_code == 400
    assert "Allowed upload types" in response.json()["detail"]


def test_batch_parses_mgf_upload():
    with TestClient(app) as client:
        response = client.post(
            "/api/batch",
            files={"file": ("caffeine.mgf", CAFFEINE_MGF, "text/plain")},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["n"] == 1
    assert body["results"][0]["name"] == "Caffeine"
