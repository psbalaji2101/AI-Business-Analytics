"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import admin, ai, analytics, asins, auth, dashboard
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
app.include_router(ai.router, prefix=prefix)
app.include_router(admin.router, prefix=prefix)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "env": settings.environment}
