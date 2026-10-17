"""CORS allows an explicit origin list and does not send credentials."""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import LOCAL_CORS_ORIGINS, build_app


def _allow_origin(client: TestClient, origin: str) -> str | None:
    response = client.get("/api/ping", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-credentials") != "true"
    return response.headers.get("access-control-allow-origin")


def test_cors_defaults_to_local_dev_origins(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("PEAKWISE_CORS_ORIGINS", raising=False)
    with TestClient(build_app()) as client:
        for origin in LOCAL_CORS_ORIGINS:
            assert _allow_origin(client, origin) == origin
        assert _allow_origin(client, "https://evil.example") is None


def test_cors_origins_from_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(
        "PEAKWISE_CORS_ORIGINS",
        "https://arnold-rg.github.io, http://127.0.0.1:5173",
    )
    with TestClient(build_app()) as client:
        assert _allow_origin(client, "https://arnold-rg.github.io") == "https://arnold-rg.github.io"
        assert _allow_origin(client, "http://127.0.0.1:5173") == "http://127.0.0.1:5173"
        assert _allow_origin(client, "http://localhost:5173") is None
