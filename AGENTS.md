# AGENTS.md

## Purpose
This file helps AI coding agents understand the project quickly and act productively.
Use it as the first source of truth for repository structure, key commands, and conventions.

## Project overview
- Full-stack analytics dashboard for Amazon sellers.
- `backend/`: FastAPI Python service with ASIN management, scraping, analytics, and auth.
- `frontend/`: React + TypeScript + Vite SPA with login, dashboard, analytics, and ASIN management.
- `context.md`: architecture decisions, phase status, and design rationale.
- `README.md`: developer setup, local commands, testing, and deployment notes.

## Important workflows
- `make install`: install backend Python deps and frontend npm deps.
- `make dev`: run backend on `:8000` and frontend on `:5173` together.
- `make test`: run backend tests from `backend`.
- `make scrape`: run the scraper for active ASINs.
- `make seed`: seed demo ASINs and synthetic snapshot history.
- `make seed-asins`: seed ASINs only.

## Backend conventions
- Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic v2.
- `backend/app/main.py` is the FastAPI entrypoint.
- `backend/app/api/routers/` contains route definitions.
- `backend/app/services/` contains business logic.
- `backend/app/scrapers/` uses an adapter pattern (`html`, `mock`).
- `backend/app/ai/` contains LLM provider abstractions and insight logic.
- `backend/app/schemas/` defines request/response models for the API.
- `backend/app/core/config.py` reads settings from env vars.
- Scheduler is started in `backend/app/scheduler/jobs.py`.

## Frontend conventions
- Vite + React + Tailwind CSS.
- `frontend/src/App.tsx` defines routes and protected pages.
- `frontend/src/api/` contains the typed API client and shared types.
- `frontend/src/auth/` contains auth state and login flow.
- `frontend/src/pages/` contains main dashboard, analytics, and ASIN management views.
- `frontend/src/components/ui/` contains shared UI primitives.

## Key guidance for agents
- Prefer small, targeted changes and preserve existing structure.
- Link to existing docs instead of duplicating them.
- Use `context.md` for high-level design decisions and backlog status.
- Use `README.md` for setup and runtime commands.
- Avoid introducing a new architecture unless the user explicitly requests it.

## Helpful references
- `README.md` — setup, dev commands, testing, deployment notes.
- `context.md` — architecture, rationale, progress, and future scope.
- `backend/pyproject.toml` — dependencies and Python configuration.
- `frontend/package.json` — frontend scripts and package dependencies.
