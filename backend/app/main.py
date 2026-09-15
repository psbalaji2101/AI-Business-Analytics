"""FastAPI application entry point."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routers import (
    admin,
    ai,
    alerts,
    analytics,
    asins,
    auth,
    dashboard,
    operational,
    sales,
    users,
)
from app.core.config import settings
from app.db.session import init_db
from app.scheduler.jobs import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = settings.api_v1_prefix
app.include_router(auth.router, prefix=prefix)
app.include_router(asins.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)
app.include_router(analytics.router, prefix=prefix)
app.include_router(alerts.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(ai.router, prefix=prefix)
app.include_router(admin.router, prefix=prefix)
app.include_router(sales.router, prefix=prefix)
app.include_router(operational.router, prefix=prefix)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "env": settings.environment}


# The published all-in-one image includes the compiled React application. Local
# development continues to use Vite when FRONTEND_DIST_DIR is absent.
frontend_dist_setting = os.environ.get("FRONTEND_DIST_DIR")
frontend_dist = Path(frontend_dist_setting) if frontend_dist_setting else None
if frontend_dist and frontend_dist.is_dir():
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def serve_frontend(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        requested_file = (frontend_dist / path).resolve()
        if requested_file.is_relative_to(frontend_dist.resolve()) and requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(frontend_dist / "index.html")
