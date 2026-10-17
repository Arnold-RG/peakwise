import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.routes import router
from backend.app.config import ROOT

# Vite dev server. Override with PEAKWISE_CORS_ORIGINS (comma-separated).
LOCAL_CORS_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]


def cors_origins() -> list[str]:
    raw = os.environ.get("PEAKWISE_CORS_ORIGINS", "")
    origins = [part.strip().rstrip("/") for part in raw.split(",")]
    origins = [origin for origin in origins if origin]
    return origins or list(LOCAL_CORS_ORIGINS)


def build_app() -> FastAPI:
    application = FastAPI(
        title="Peakwise",
        description="Name the molecule in an LC-MS/MS spectrum (SMILES from peaks).",
        version="1.0.0",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router, prefix="/api")

    frontend_dist = ROOT / "frontend" / "dist"
    if frontend_dist.exists():
        application.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

        @application.get("/{full_path:path}")
        def spa(full_path: str):
            candidate = frontend_dist / full_path
            if full_path and candidate.exists() and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(frontend_dist / "index.html")

    return application


app = build_app()
