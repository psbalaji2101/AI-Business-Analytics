# AI Business Analytics — developer Makefile
# Works with GNU Make on Linux/macOS and on Windows via Git Bash or WSL.

# Virtualenv binary dir differs per OS (Windows venvs use Scripts/).
ifeq ($(OS),Windows_NT)
  VBIN := .venv/Scripts
else
  VBIN := .venv/bin
endif

PY := $(VBIN)/python

.DEFAULT_GOAL := help

.PHONY: help install clean dev dev-backend dev-frontend scrape seed seed-asins test

help:
	@echo "AI Business Analytics — available targets:"
	@echo "  make install      Create the venv and install backend + frontend dependencies"
	@echo "  make clean        Remove installed dependencies, caches and the local DB"
	@echo "  make dev          Start the app: backend (:8000) + frontend (:5173) together"
	@echo "  make scrape       Scrape all ACTIVE ASINs in the DB for fresh data"
	@echo "  make seed         Seed 7 ASINs + ~90 days of synthetic history (demo)"
	@echo "  make seed-asins   Seed 7 ASINs only (no snapshots), then run 'make scrape'"
	@echo "  make test         Run the backend test suite"

install:
	cd backend && python -m venv .venv && $(PY) -m pip install --upgrade pip \
		&& $(PY) -m pip install -e . && $(PY) -m pip install pytest pytest-asyncio
	cd frontend && npm install

clean:
	-rm -rf backend/.venv
	-rm -rf frontend/node_modules frontend/dist frontend/.vite
	-rm -f backend/app.db backend/test_app.db
	-rm -rf backend/.pytest_cache backend/.ruff_cache
	-find . -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "Cleaned dependencies, caches and local DB."

# Run backend and frontend concurrently (Ctrl+C stops both).
dev:
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	cd backend && $(PY) -m uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

# Scrape every ACTIVE ASIN currently in the database (uses the html adapter via .env).
scrape:
	cd backend && $(PY) -m app.scrape_now

seed:
	cd backend && $(PY) -m app.seed

seed-asins:
	cd backend && $(PY) -m app.seed --asins-only

test:
	cd backend && $(PY) -m pytest -q
