# AI Business Analytics Dashboard — Project Context & Progress Log

> Single source of truth for architecture decisions, progress, and pending work.
> Updated at the end of every milestone.

---

## 1. Product Summary

A centralized web dashboard for an Amazon e-commerce seller that replaces scattered
Excel/CSV/manual reports with one modular UI. It manages product ASINs, scrapes Amazon
product data 3x/day, stores historical snapshots, renders business dashboards & analytics,
and generates AI-powered natural-language insights.

**Primary users:** Business analysts / founders monitoring Amazon catalog performance.

---

## 2. Phase Plan & Status

| Phase | Description | Status |
|------|--------------------------------|-------------|
| 1 | Architecture & tech stack | ✅ COMPLETE & APPROVED |
| 2 | Project scaffolding | ✅ COMPLETE |
| 3 | Backend implementation | ✅ COMPLETE |
| 4 | Frontend implementation | ✅ COMPLETE |
| 5 | Scraper integration | ✅ COMPLETE (live Amazon HTML scraping) |
| 6 | AI analytics layer | ⏸️ ON HOLD (deferred by user) |
| 7 | Testing + deployment | ✅ COMPLETE |
| 8 | Sales report + India state map | ✅ COMPLETE |
| 8.1 | Real India choropleth map | ✅ COMPLETE |

**Approved decisions:** Scraping = **direct HTML** (httpx/Playwright) default; AI = **Mock LLM** now, swappable later. Phase 3: seed **~90 days synthetic snapshots**; AI endpoints stay **placeholders**. Phase 4: dark SaaS UI per reference images. Phase 5: live HTML scraping verified against amazon.in. Phase 6 deferred; jumped to Phase 7.

**Current blocker:** None. Phases 1-5 + 7 complete. Phase 6 (AI layer) remains on hold until requested.

---

## 3. Tech Stack (Recommended) + Rationale

### Frontend — React 18 + TypeScript + Vite
- **Why React:** Largest ecosystem, easiest for new devs to onboard, best chart/table libraries.
- **Why Vite:** Fast dev server + build, simpler than Next.js for an internal SPA dashboard (no SEO/SSR needs).
- **Why TypeScript:** Type safety across API contracts → fewer runtime bugs, self-documenting.
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives) → clean, professional SaaS look, accessible, no heavy theme lock-in.
- **Data fetching:** TanStack Query (React Query) → caching, background refetch, loading/error states for free.
- **Charts:** Recharts (line/bar) + a lightweight heatmap. Practical, declarative, good defaults.
- **Tables:** TanStack Table → pagination, sorting, filtering built in (needed for Manage ASINs).
- **Routing:** React Router v6.

### Backend — Python 3.11 + FastAPI
- **Why Python:** Best ecosystem for scraping (httpx, BeautifulSoup, Playwright) **and** AI/LLM SDKs in one language.
- **Why FastAPI:** Async, automatic OpenAPI docs (free API contract), Pydantic validation, fast, easy to read.
- **ORM:** SQLAlchemy 2.0 (async) + Alembic for migrations.
- **Validation/Schemas:** Pydantic v2 (shared request/response models → becomes the API contract).

### Database — PostgreSQL 16
- **Why Postgres:** Reliable, relational fit for products + snapshots, strong JSONB for flexible raw scrape payloads, great time-series queries with indexes.
- **Time-series:** Snapshots table partitioned/indexed by `(asin_id, scraped_at)`. TimescaleDB is an **optional** future upgrade — **not** needed at launch (avoid overengineering).
- **Analytics:** Computed on-read from snapshots with SQL window functions; cache hot aggregates in an `analytics_cache` table if needed later.

### Scheduler — APScheduler (launch) → Celery + Redis (scale path)
- **Why APScheduler first:** 3x/day cron is low-volume; APScheduler runs in-process, zero extra infra, trivial to configure.
- **Scale path:** When ASIN count or marketplaces grow, swap to Celery workers + Redis broker + Celery Beat. The scraper service is written behind an interface so this swap is isolated.

### Scraping — Adapter pattern, third-party API primary + HTML fallback
- **Recommended practical approach:** Use a **third-party Amazon data provider** (e.g. Rainforest API / ScraperAPI / Oxylabs) as the **primary** adapter.
  - Rationale: Amazon aggressively blocks scrapers (CAPTCHAs, IP bans, layout changes). A provider handles proxies, anti-bot, and parsing — far more reliable and legally cleaner than raw scraping at scale.
- **Fallback adapter:** Direct HTML scraping (httpx + BeautifulSoup, Playwright for JS) behind the same interface — usable for dev/testing or cost control, with retry + backoff + rotating proxy support.
- **Abstraction:** `ScraperAdapter` interface → `AmazonRainforestAdapter`, `AmazonHtmlAdapter`, future `FlipkartAdapter`, etc. A `MockAdapter` seeds realistic data so the full app is demoable without live scraping or API keys.

### AI Layer — Provider-abstracted LLM
- **Abstraction:** `LLMProvider` interface → `OpenAIProvider`, `AnthropicProvider`, `LocalProvider`. Model swappable via config/env.
- **Insight engine:** Deterministic analytics (Python/SQL) computes the numbers (price drops, review velocity, anomalies via z-score / rolling stats); the LLM only **narrates** those facts into natural language. This keeps insights accurate, cheap, and not hallucinated.
- **Assistant:** NL Q&A endpoint that maps questions → structured analytics queries → LLM summarization.

### Deployment — Docker + managed Postgres
- **Dev:** `docker-compose` (api, db, frontend, optional redis).
- **Prod:** Containers on Render / Railway / Fly.io / AWS ECS; managed PostgreSQL (RDS / Neon / Supabase); frontend static build on CDN (Netlify/Vercel/S3+CloudFront). Secrets via env vars.

---

## 4. High-Level Architecture (ASCII)

```
                          ┌─────────────────────────────────────────┐
                          │              BROWSER (SPA)                │
                          │  React + TS + Tailwind + shadcn/ui        │
                          │  ┌─────────┬──────────────┬────────────┐  │
                          │  │ Login   │ Manage ASINs │ Dashboard  │  │
                          │  │         │ Analytics    │ AI Assist  │  │
                          │  └─────────┴──────────────┴────────────┘  │
                          └───────────────────┬───────────────────────┘
                                              │ HTTPS / REST (JSON)
                                              ▼
                          ┌─────────────────────────────────────────┐
                          │          BACKEND API (FastAPI)            │
                          │                                           │
                          │  Auth │ ASIN CRUD │ Dashboard │ Analytics │
                          │  ───────────────────────────────────────  │
                          │  Service Layer (business logic)           │
                          │   • ASINService   • SnapshotService       │
                          │   • AnalyticsService • InsightService     │
                          └───┬──────────────┬─────────────┬──────────┘
                              │              │             │
              ┌───────────────▼──┐   ┌───────▼──────┐  ┌───▼──────────────┐
              │  PostgreSQL 16   │   │  Scheduler   │  │   AI Layer       │
              │ products         │   │ APScheduler  │  │ LLMProvider iface │
              │ snapshots        │   │  3x / day    │  │ OpenAI/Anthropic │
              │ analytics_cache  │   └──────┬───────┘  │ + Insight engine │
              └──────────────────┘          │          └──────────────────┘
                              ▲              ▼
                              │      ┌────────────────────────────┐
                              │      │   Scraper Service           │
                              └──────│  ScraperAdapter (interface) │
                                     │   • Rainforest (primary)    │
                                     │   • HTML/Playwright (fallbk)│
                                     │   • Mock (dev/seed)         │
                                     └───────────┬─────────────────┘
                                                 ▼
                                          Amazon.in product pages
```

---

## 5. Component Breakdown

### Frontend
- `auth/` — Login page, mock auth, session persistence (localStorage), route guards.
- `pages/ManageAsins` — ASIN table (CRUD, search, filter, CSV bulk upload, pagination/sort).
- `pages/Dashboard` — KPI cards, product grid, category/inventory/price/ratings widgets, AI insight widget.
- `pages/Analytics` — trend charts (7/30/90/custom), comparisons, heatmaps, ranking tables, AI anomaly insights.
- `components/ai` — AI assistant chat panel.
- `api/` — typed API client (matches backend contract).
- `components/ui` — shared shadcn/ui primitives, layout, sidebar nav.

### Backend
- `api/routers/` — `auth`, `asins`, `dashboard`, `analytics`, `ai`.
- `services/` — business logic (decoupled from HTTP).
- `scrapers/` — adapter interface + implementations.
- `ai/` — LLM provider interface + insight engine.
- `scheduler/` — job definitions + APScheduler setup.
- `db/` — SQLAlchemy models, session, Alembic migrations.
- `schemas/` — Pydantic request/response models (the API contract).
- `core/` — config, security, logging.

---

## 6. Proposed Folder Structure

```
ai-business-analytics/
├── context.md
├── docker-compose.yml
├── README.md
│
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── core/
│   │   │   ├── config.py           # env/settings (pydantic-settings)
│   │   │   ├── security.py         # auth/session helpers
│   │   │   └── logging.py
│   │   ├── api/
│   │   │   ├── deps.py             # shared dependencies
│   │   │   └── routers/
│   │   │       ├── auth.py
│   │   │       ├── asins.py
│   │   │       ├── dashboard.py
│   │   │       ├── analytics.py
│   │   │       └── ai.py
│   │   ├── schemas/                # Pydantic models (API contract)
│   │   │   ├── asin.py
│   │   │   ├── snapshot.py
│   │   │   ├── analytics.py
│   │   │   └── ai.py
│   │   ├── services/
│   │   │   ├── asin_service.py
│   │   │   ├── snapshot_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── insight_service.py
│   │   ├── scrapers/
│   │   │   ├── base.py             # ScraperAdapter interface
│   │   │   ├── amazon_rainforest.py
│   │   │   ├── amazon_html.py
│   │   │   └── mock.py
│   │   ├── ai/
│   │   │   ├── base.py             # LLMProvider interface
│   │   │   ├── openai_provider.py
│   │   │   ├── anthropic_provider.py
│   │   │   └── insight_engine.py   # deterministic stats + prompts
│   │   ├── scheduler/
│   │   │   └── jobs.py             # APScheduler 3x/day
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   ├── session.py
│   │   │   └── models.py           # SQLAlchemy ORM
│   │   └── seed.py                 # seed 7 ASINs + mock snapshots
│   ├── alembic/                    # migrations
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── Dockerfile
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── router.tsx
        ├── api/
        │   ├── client.ts
        │   └── types.ts            # mirrors backend schemas
        ├── auth/
        │   ├── AuthContext.tsx
        │   └── LoginPage.tsx
        ├── components/
        │   ├── ui/                 # shadcn primitives
        │   ├── layout/             # sidebar, topbar
        │   ├── charts/
        │   └── ai/AssistantPanel.tsx
        ├── pages/
        │   ├── ManageAsins.tsx
        │   ├── Dashboard.tsx
        │   └── Analytics.tsx
        └── lib/
```

---

## 7. API Contract (REST, JSON)

Base URL: `/api/v1`

### Auth
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| POST | `/auth/logout` | — | `204` |
| GET | `/auth/me` | — | `{ user }` |

### ASINs
| Method | Path | Notes |
|--------|------|-------|
| GET | `/asins` | query: `q, category, sub_category, active, page, page_size, sort` |
| POST | `/asins` | create one |
| GET | `/asins/{id}` | detail |
| PUT | `/asins/{id}` | edit |
| DELETE | `/asins/{id}` | soft delete / invalidate |
| PATCH | `/asins/{id}/tracking` | `{ active: bool }` enable/disable |
| POST | `/asins/bulk-upload` | CSV multipart |

### Dashboard
| Method | Path | Notes |
|--------|------|-------|
| GET | `/dashboard/summary` | KPI cards + inventory + category breakdown |
| GET | `/dashboard/products` | latest snapshot per active ASIN (grid) |
| GET | `/dashboard/insights` | AI insight widget text |

### Analytics
| Method | Path | Notes |
|--------|------|-------|
| GET | `/analytics/trends` | `metric, interval(7/30/90/custom), from, to, asin, category` |
| GET | `/analytics/compare` | product-vs-product / category-vs-category |
| GET | `/analytics/rankings` | ranking tables (winners/losers) |
| GET | `/analytics/anomalies` | detected anomalies + AI narration |

### AI Assistant
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/ai/ask` | `{ question }` | `{ answer, data?, charts? }` |

### Sales
| Method | Path | Notes |
|--------|------|-------|
| POST | `/sales/upload` | CSV multipart; dedup by SHA-256 content hash → `{ duplicate, inserted, total_units, total_gross }` |
| GET | `/sales/summary` | KPIs (units, gross, orders, distinct ASINs/states, date range); filters `asin, date_from, date_to` |
| GET | `/sales/by-asin` | per-ASIN units/gross/orders; product name from ASIN catalog (not overridden by CSV) |
| GET | `/sales/by-state` | per-state units/gross/orders (India map) |
| GET | `/sales/uploads` | list uploaded files |
| DELETE | `/sales/uploads/{id}` | remove an upload + its rows (cascade) |

### Scraping (internal/admin)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/admin/scrape/run` | trigger scrape manually (also runs 3x/day via scheduler) |

---

## 8. Database Schema

```sql
-- Products being tracked
CREATE TABLE asins (
    id              BIGSERIAL PRIMARY KEY,
    asin            VARCHAR(20) UNIQUE NOT NULL,
    product_name    TEXT NOT NULL,
    category        TEXT,
    sub_category    TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- tracking on/off
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,  -- soft delete/invalidate
    date_added      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_scraped_at TIMESTAMPTZ
);

-- Historical scrape snapshots (time-series)
CREATE TABLE snapshots (
    id                BIGSERIAL PRIMARY KEY,
    asin_id           BIGINT NOT NULL REFERENCES asins(id) ON DELETE CASCADE,
    scraped_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    price             NUMERIC(12,2),
    currency          VARCHAR(8) DEFAULT 'INR',
    total_rating_cnt  INTEGER,
    avg_rating        NUMERIC(3,2),
    star_5            INTEGER,
    star_4            INTEGER,
    star_3            INTEGER,
    star_2            INTEGER,
    star_1            INTEGER,
    buy_box_available BOOLEAN,                 -- true => In Stock
    in_stock          BOOLEAN,                 -- derived from buy_box
    raw_payload       JSONB,                   -- full provider/scraper response
    -- derived (computed & stored for fast reads):
    positive_rating   INTEGER,                 -- star_5 + star_4
    negative_rating   INTEGER                  -- star_3 + star_2 + star_1
);

CREATE INDEX idx_snapshots_asin_time ON snapshots (asin_id, scraped_at DESC);

-- Optional cached aggregates for heavy analytics (added only if needed)
CREATE TABLE analytics_cache (
    id          BIGSERIAL PRIMARY KEY,
    scope       TEXT,        -- e.g. 'category:Mobile Holder'
    metric      TEXT,
    period      TEXT,
    payload     JSONB,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scrape run audit (retries, errors)
CREATE TABLE scrape_runs (
    id          BIGSERIAL PRIMARY KEY,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status      TEXT,        -- success | partial | failed
    adapter     TEXT,        -- rainforest | html | mock
    total       INTEGER,
    succeeded   INTEGER,
    failed      INTEGER,
    error_log   JSONB
);
```

**Derived metrics computed at query time from snapshots:**
- Review velocity = Δ `total_rating_cnt` / Δ days
- Rating growth = Δ `avg_rating` over interval
- Price change = latest `price` − previous `price`
- Trends = ordered snapshots over interval (SQL window functions)

**Seed ASINs (Phase 2):**
B0DZHX9H4L, B0DZHW42T8, B0FH9L7Q86, B0DXCWSMBQ, B0FY3GW1Y6, B0DXCV76QP, B0FY3L1FNX — all "Mobile Holder".

---

## 9. Key Design Decisions (Summary)

1. **Python/FastAPI backend** — unifies scraping + AI in one language; auto API docs.
2. **React SPA (Vite)** — internal dashboard, no SSR needed; rich table/chart ecosystem.
3. **PostgreSQL only at launch** — relational + JSONB covers products, snapshots, analytics without extra infra. TimescaleDB deferred.
4. **Scraper adapter pattern** — third-party API primary (reliability/anti-bot), HTML fallback, Mock for demo. Future marketplaces plug in cleanly.
5. **AI = deterministic stats + LLM narration** — numbers computed in code (accurate), LLM only phrases them (no hallucinated metrics). Provider abstracted for swap.
6. **APScheduler now, Celery later** — right-sized for 3x/day; clean upgrade path.
7. **Mock data adapter** — entire product is demoable end-to-end without live Amazon access or API keys.

---

## 10. Pending / Next

- **Phase 3 (next):** Implement dashboard/analytics aggregation services (latest snapshot per ASIN, KPIs, category breakdown, trends via SQL window functions), wire dashboard/analytics routers.
- **Phase 4:** Build ASIN table UI (TanStack Table), dashboard widgets (Recharts), analytics charts, AI assistant panel.
- **Phase 5:** Implement HTML parser in `amazon_html.py`, wire `scrape_job` to persist snapshots, retries/proxy.
- **Phase 6:** Insight engine (z-score anomalies, review velocity) + real LLM providers (OpenAI/Anthropic).
- **Phase 7:** pytest suite, deployment configs.

---

## 11. Scaffolding Notes (Phase 2)

**Built and runnable:**
- Backend boots (`uvicorn app.main:app`), auto-creates tables, starts scheduler.
- **Fully working now:** auth (mock JWT login), ASIN CRUD + search/filter/pagination/sort + CSV bulk upload, seed script (7 ASINs).
- **Wired stubs (return structured placeholders):** dashboard summary/products/insights, analytics trends/compare/rankings/anomalies, AI ask.
- Scraper adapters: `MockAdapter` (functional, deterministic data), `AmazonHtmlAdapter` (fetch + retry/backoff/proxy done; HTML parsing is Phase 5 TODO), `factory`.
- AI: `LLMProvider` interface, `MockLLMProvider`, `factory`.
- Frontend boots (Vite): login page, protected routing + route guards, sidebar layout, localStorage session, typed API client; page bodies are placeholders pending Phase 4.
- Docker Compose (db + backend + frontend), Dockerfiles, READMEs.

**Local dev defaults:** SQLite (`sqlite+aiosqlite`) for zero-setup; Postgres via docker-compose. Scraper=mock, LLM=mock in `.env.example`.

---

## Change Log
- **Phase 1 (complete, approved):** Architecture, tech stack, folder structure, API contract, DB schema documented. User approved; chose HTML scraping + Mock LLM.
- **Phase 2 (complete):** Scaffolded `backend/` (FastAPI app, config, DB models, schemas, auth, ASIN CRUD service+router, scraper & AI abstractions, scheduler, seed) and `frontend/` (Vite React TS, Tailwind, auth flow, routing, layout, page stubs, typed API client). Added docker-compose, Dockerfiles, READMEs, .gitignore.
- **Phase 3 (complete):** Implemented backend data layer & analytics. Added `SnapshotService` (latest-per-ASIN, deltas, `scrape_all_active`) and `AnalyticsService` (dashboard summary/KPIs/category breakdown, product cards with derived metrics, trends, compare, rankings). Wired dashboard & analytics routers to real data; added `admin/scrape/run` trigger; scheduler now calls `scrape_all_active`. Enriched seed with ~90 days of synthetic snapshots. Added analytics response schemas. Fixed SQLite BigInteger PK autoincrement (Integer variant) and added `email-validator` dep. **Validated end-to-end via smoke test** (login, ASIN list, dashboard summary/products, trends 31 pts, rankings, auth guards) — all pass against seeded data.
- **Phase 4 (complete):** Built the full dark-themed SPA matching the reference screenshots (ASIN Tracker / Kratos Analytics). Added design system (CSS-variable dark/light theming + working toggle, Badge/Button/Card/KpiCard/Modal/Input/Select/Spinner), `AppLayout` (branded header, status strip, sidebar), restyled login. Implemented all three pages wired to the API via React Query hooks: **Manage ASINs** (catalog table, search, category filter, sort, pagination, Add/Edit modal, soft-delete, Sample/Upload CSV, Amazon deep links), **Business Dashboard** (KPI cards, filters incl. price range + status, product table with rating/positive/negative/stock badges, Download CSV, category breakdown), **Business Analytics** (metric + 7/30/90 interval + ASIN/category selectors, Recharts price/rating/etc. trend line, winners/losers rankings table). **Validated live in-browser**: login → dashboard (avg ₹493 / 3.97★ / 7 in-stock), ASIN catalog (7 rows, pagination), analytics (chart renders, rankings sorted) — all API calls 200. Frontend `npm run build` passes (tsc + vite, no type errors).
- **Phase 4.1 (fix):** Manage ASINs operations reported as "not working" were actually succeeding on the backend (verified: POST 201, PUT 200, DELETE 204, bulk-upload 200) — the real gap was **silent failure with no user feedback** (e.g. backend down or duplicate ASIN). Added a `ToastProvider`/`useToast` notification system, success/error toasts on all mutations, inline error banner + "Saving…" loading state in the ASIN modal, and a backend **409 duplicate-ASIN guard** (was a raw 500). Verified in-browser: duplicate add shows "ASIN … already exists", valid add shows success + new row. Reset DB to clean 7-ASIN seed.
- **Phase 5 (complete):** Implemented **live Amazon.in HTML scraping**. New `parser.py` (pure, testable) extracts title, price, avg rating, review count, 5→1★ counts (computed from histogram percentages × total, rounding absorbed into 5★), and Buy Box → In/Out of Stock; includes CAPTCHA/bot-check detection (`ScraperBlockedError`). Upgraded `AmazonHtmlAdapter` with rotating user-agents, retry+backoff+jitter, proxy support, and a block-retry. Added `product_name` to `ScrapeResult`; `scrape_all_active` now updates the ASIN's name from the scrape and applies a polite inter-request delay (`SCRAPER_REQUEST_DELAY_SECONDS`). Added `app/scrape_now.py` CLI and `--asins-only` seed flag. Set default deploy adapter to `html` (docker-compose). **Verified live**: scraped all 7 ASINs (7/7 success) — e.g. B0DZHX9H4L “Kratos Mobile Holder for Bike…” ₹499 / 4.1★ / 1,118 reviews / stars 693-168-78-45-134; dashboard summary 7 in-stock, avg ₹527.57 / 4.09★ / 6,560 reviews. **Note:** analytics trends are sparse (one point) until more scheduled scrapes (3×/day) accumulate history.
- **Phase 6:** ON HOLD per user request — skipped to Phase 7.
- **Phase 7 (complete):** **Testing** — added `backend/tests/` pytest suite (24 tests, all passing): `test_auth` (login/guards), `test_asins` (CRUD, 409 duplicate, search, pagination, tracking, delete + re-add, CSV upload), `test_analytics` (scrape-run, dashboard summary/products derived metrics, trends, rankings via mock adapter), `test_parser` (parses fixture HTML → fields & star math, detects CAPTCHA). Isolated test DB via `conftest.py` + httpx ASGITransport (no live server). **Deployment** — added frontend `nginx.conf` (SPA fallback + `/api`→backend proxy, so prod is same-origin/no CORS), wired it into the frontend Dockerfile, added backend/frontend `.dockerignore`, Postgres healthcheck + `restart: unless-stopped` + `depends_on: service_healthy` in docker-compose, and README Testing/Scraping/Deployment sections.
- **Phase 7.1 (fixes + tooling):**
  - **Delete bug:** delete was a *soft*-delete (`is_deleted=True`), so the duplicate guard still found the hidden row and blocked re-adding (live 409 reproduced in logs). Switched to a **hard delete** (`AsinService.delete` removes the row; snapshots cascade) and added **revive-on-readd** (re-adding a previously soft-deleted ASIN reactivates it instead of 409). Verified live: delete 204 → re-add 201.
  - **Scrape on add:** adding an ASIN now scrapes it **inline** (best-effort) so its real data appears immediately; CSV bulk upload triggers a **background** scrape of all active ASINs. Verified: re-added B0DZHX9H4L came back with the real scraped title + `last_scraped_at`.
  - Confirmed `scrape_all_active` only scrapes ASINs with `is_active=True` (and not deleted).
  - Added root **`Makefile`** (`install`, `clean`, `dev`, `scrape`, `seed`, `seed-asins`, `test`) with OS-aware venv paths, plus a `backend/.env` so dev/scrape use the live html adapter. Updated frontend delete wording to reflect permanent deletion.
- **Phase 7.2 (fix):** Dashboard "active products" count (e.g. 7) didn't match the product grid (6) because `product_cards()` skipped ASINs with no snapshot yet (`if not snap: continue`) — the same omission hid newly-added/un-scraped ASINs from the **Analytics ASIN dropdown** (which sources from that endpoint). Fixed `product_cards()` to return a card for **every active ASIN**, with null metrics when not yet scraped. Frontend now renders a gray **"No Data"** status for un-scraped products instead of a misleading "Out of Stock". Verified: summary active=7, grid rows=7, inventory 7 In, and the re-added ASIN appears with data in both the grid and the dropdown.
- **Phase 7.3 (fix):** **User-edited product names were wiped on the next scrape** (the scraper always set `product_name` to the Amazon title). Added a `name_is_custom` flag on `asins` (additive SQLite/Postgres migration in `init_db`). Policy: a name typed by the user (Add or Edit) or supplied in a CSV row is **custom and never overwritten**; the scraper only fills names that are blank/placeholder (seed ASINs, blank CSV rows). Exposed `name_is_custom` in `AsinOut`; mock adapter now returns a name so the behavior is testable. Verified live: rename → scrape → name preserved. 25 tests pass.
- **Phase 8 (Sales report + India state map):** Added a **Sales** module — upload Amazon sales-report CSVs (e.g. "Sales Report April to June.csv") and analyze units/revenue/geography.
  - **Backend:** new `sales_uploads` + `sales_records` tables (auto-created via `create_all`). `SalesService` parses the CSV (asin, itemName, day+month+year→`order_date`, grossUnits→units, grossSales, netUnits/netSales, category/subcategory, stateName/city/postalCode), and exposes aggregations `summary` / `by_asin` / `by_state` (with optional `asin`, `date_from`, `date_to` filters). New `sales` router: `POST /sales/upload`, `GET /sales/{summary,by-asin,by-state,uploads}`, `DELETE /sales/uploads/{id}`.
  - **Item name not overridden:** `by_asin` LEFT JOINs `asins` and uses `coalesce(asins.product_name, sales_records.item_name, asin)` — the Manage-page name always wins; the CSV name is only a fallback for untracked ASINs.
  - **Deduplication:** each upload stores the **SHA-256 of the raw file bytes** with a UNIQUE constraint. Re-uploading the identical file is detected and **skipped** (no rows inserted; returns `duplicate:true`), so uploading the same file twice can't double the totals. Deleting an upload cascades its rows (enables a clean re-upload).
  - **Frontend:** new **Sales Report** page (nav + `/sales` route) with CSV upload, ASIN/date filters, KPI cards (units, gross, orders, states), a per-ASIN sales table (catalog names), an uploaded-files table with delete, a **State Leaderboard** bar list, and a dependency-free **India bubble map** (`components/sales/IndiaMap.tsx`) — hardcoded state centroids projected onto a low-vertex India silhouette, bubble size ∝ units, hover tooltip (units/gross/orders). No new npm deps.
  - **Verified:** `frontend npm run build` passes; backend suite **28 tests pass** (added `tests/test_sales.py` covering upload aggregation, catalog-name-not-overridden, duplicate-file skip, and delete-removes-rows).
- **Phase 8.1 (real India choropleth map):** Replaced the crude bubble map with a proper **state-level choropleth**. Preprocessed authoritative district boundaries (udit-001/india-maps-data) by geometrically **dissolving districts into 36 clean state/UT polygons** (polygon union, coords rounded to ~110 m) → `frontend/public/india_states.geojson` (~82 KB, modern names incl. Telangana, Ladakh, Odisha, Uttarakhand, Puducherry). Rewrote `IndiaMap.tsx` to fetch the GeoJSON and render each state as an SVG `<path>` via a latitude-corrected equirectangular projection auto-fit to the geometry bounds; fill intensity ∝ √units (choropleth), hover highlights the state with a units/gross/orders tooltip, plus a Low→High legend. Robust CSV→GeoJSON name matching (canonicalize `&`→`AND`, strip non-letters, alias `PONDICHERRY→PUDUCHERRY`, `CHATTISGARH→CHHATTISGARH`, `ORISSA→ODISHA`, `ANDAMAN & NICOBAR IS→…ISLANDS`, etc.); unmatched regions are listed under the map. No new runtime npm deps (union lib used only in a throwaway temp workspace). **Verified live in-browser**: clean India map with correct per-state shading (Maharashtra darkest), `npm run build` passes.
- **Deployment (local):** Docker Desktop engine was unavailable, so the app was run locally via the venv/npm path — backend `uvicorn app.main:app` on `:8000` (SQLite, seeded) and Vite dev server on `:5173` (proxies `/api`→backend). Smoke-tested login + `/sales/*` endpoints; Sales page and India map verified in the integrated browser.
- **Phase 8.2 (Sales UX enhancements):** Per user feedback — (1) removed the **State Leaderboard** card, map is now full-width; (2) the ASIN column in the **Sales by Product** table now **deep-links to `amazon.in/dp/{asin}`** (external-link icon); (3) the **ASIN filter is a searchable combobox** (`components/sales/AsinCombo.tsx` — trigger + embedded search box + scrollable ASIN/product-name list with click-outside close), replacing the plain text box; (4) fixed the header **Refresh** button — now `await qc.refetchQueries({ type: "active" })` with a spinning icon + "Refreshing…" state (previously `invalidateQueries()` gave no feedback and appeared to do nothing); (5) `by_asin` LEFT JOIN now ignores soft-deleted ASINs (`Asin.is_deleted == False`) so the Manage-page name override only uses live catalog rows. Verified live in-browser (search filters list, selecting an ASIN filters KPIs/table/map, ASIN link resolves); `npm run build` + sales tests pass.
- **Phase 8.3 (uploads list):** `list_uploads` now returns the **10 most recent** uploads only (`ORDER BY uploaded_at DESC LIMIT 10`). Restarted the local backend with `--reload` and verified the endpoint order/cap.
- **Phase 8.4 (configurable table rows):** The **Sales by Product (ASIN)** table now has a **Rows selector (50 / 100 / 500)** in its header (default 50) that client-side-limits the displayed rows, plus a "Showing X of Y products" footer. Verified in-browser; `npm run build` passes.
- **Phase 8.5 (table pagination):** Added **Previous/Next pagination** to the Sales by Product table (the Rows selector is the page size). Footer shows the `A–B of N products` range; page auto-resets to 1 when filters or page size change; page index is clamped to the available page count. Verified live (361 products, page 2 shows "51–100 of 361"); `npm run build` passes.

### Implemented metric definitions (Phase 3)
- **price_change** = latest snapshot price − immediately-previous snapshot price
- **review_velocity** = (latest total_rating_cnt − count ~7 days ago) / 7
- **rating_growth** = latest avg_rating − avg_rating ~7 days ago
- **trends**: single ASIN → its daily series; category/all → daily average across products (last value per day)
- **rankings**: latest metric value per ASIN + change over window; `order=desc` winners / `asc` losers
- **metrics supported**: price, avg_rating, rating_count, positive, negative, stock
