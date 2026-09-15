# AI Business Analytics Dashboard

Centralized web dashboard for an Amazon e-commerce seller: manage ASINs, scrape product
data 3x/day, store historical snapshots, and surface business dashboards, analytics, and
AI-powered insights.

See [context.md](context.md) for full architecture, API contract, and progress log.

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Python 3.11 + FastAPI + SQLAlchemy 2.0
- **Database:** PostgreSQL 16 (SQLite for zero-setup local dev)
- **Scheduler:** APScheduler (3x/day scraping)
- **Scraper:** Adapter pattern — HTML (default) / Mock
- **AI:** LLM provider abstraction (Mock by default, swappable)

## Project Structure
```
backend/   FastAPI service (api, services, scrapers, ai, scheduler, db)
frontend/  React SPA (auth, pages, components, api client)
```

## Local Development

### Quick start (Make)
Requires GNU Make (use Git Bash or WSL on Windows):
```bash
make install     # create venv + install backend & frontend deps
make seed-asins  # load the 7 ASINs (no synthetic history)
make scrape      # scrape live Amazon data for all active ASINs
make dev         # run backend (:8000) + frontend (:5173) together
```
Other targets: `make clean` (remove deps/caches/DB), `make seed` (ASINs + demo history),
`make test` (backend tests). Run `make help` for the full list.

### Backend (manual)
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
copy .env.example .env
python -m app.seed          # seed the 7 tracked ASINs
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs

### Frontend
```powershell
cd frontend
npm install
npm run dev
```
App: http://localhost:5173

### Temporary Cloudflare preview

To share the app for feedback without deploying it, install `cloudflared`, then run:

```bash
make share
```

The command builds the frontend, starts FastAPI locally, and prints a temporary
`https://...trycloudflare.com` URL. Share that URL and the demo login below. Keep the
terminal and computer running; press `Ctrl+C` to stop the preview and expire the URL.

This is a development-only public tunnel. Anyone with the URL can reach the login page, so
do not use production credentials or sensitive data.

### Docker (full stack)
```powershell
docker compose up --build
```
- Frontend: http://localhost:5173 (nginx serves the build and proxies `/api` → backend)
- Backend: http://localhost:8000 (uses the live HTML scraper + Postgres)

### Run the published single-container image

The distributable image contains both the React frontend and FastAPI backend. It uses a
persistent SQLite database, so a client only needs Docker:

```bash
docker pull balajipsb/ai-business-analytics:15.09.26-2
docker run -d \
  --name ai-business-analytics \
  -p 8000:8000 \
  -v ai-business-data:/data \
  --restart unless-stopped \
  -e JWT_SECRET="replace-with-a-long-random-secret" \
  balajipsb/ai-business-analytics:15.09.26-2
```

Open http://localhost:8000. To upgrade while retaining data:

```bash
docker pull balajipsb/ai-business-analytics:15.09.26-2
docker stop ai-business-analytics
docker rm ai-business-analytics
# Run the docker run command above again; the ai-business-data volume is retained.
```

Set `AUTH_EMAIL`, `AUTH_PASSWORD`, and `SCRAPER_ADAPTER=html` with additional `-e` options
when the client needs a different initial login or live Amazon scraping. For PostgreSQL,
set `DATABASE_URL` and omit the SQLite volume if it is not needed.

## Testing
```powershell
cd backend
.venv\Scripts\Activate.ps1
pytest -q
```
Covers auth, ASIN CRUD/search/pagination/bulk-upload, dashboard & analytics aggregation
(via the mock scraper), and the Amazon HTML parser (against fixtures, no network).

## Scraping
- Default adapter is `html` (live amazon.in). Set `SCRAPER_ADAPTER=mock` for offline/demo data.
- Scheduled 3×/day via APScheduler (`SCRAPE_HOURS`, default `6,14,22`).
- Manual scrape: `python -m app.scrape_now` (CLI) or `POST /api/v1/admin/scrape/run`.
- Politeness: rotating user-agents, retry + backoff, `SCRAPER_REQUEST_DELAY_SECONDS`,
  and optional `SCRAPER_PROXY_URL` for residential proxies in production.

## Deployment Notes
- **Database:** point `DATABASE_URL` at managed PostgreSQL (RDS / Neon / Supabase).
  Local dev defaults to SQLite (zero setup); Docker uses Postgres.
- **Frontend:** `npm run build` → static assets served by nginx (or any CDN). The nginx
  config proxies `/api` to the backend, so the browser makes same-origin calls (no CORS).
- **Secrets:** set `JWT_SECRET`, `DATABASE_URL`, and (later) `LLM_API_KEY` via env vars.
- **Health:** `GET /health` for liveness checks. Postgres has a compose healthcheck.

## Login
- **Email:** balaji@aibusinessanalytics.com
- **Password:** Password1!

## Phase Status
1. ✅ Architecture & tech stack
2. ✅ Project scaffolding
3. ✅ Backend implementation
4. ✅ Frontend implementation
5. ✅ Scraper integration (live Amazon HTML)
6. ⏸️ AI analytics layer (on hold)
7. ✅ Testing + deployment
