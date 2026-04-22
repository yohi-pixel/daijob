# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YesJob is a job search platform with AI-powered resume matching and optimization. It has a Python/FastAPI backend and a vanilla HTML/JS/Tailwind frontend.

## Development Commands

### Backend

```bash
# Run from backend/ directory
cd backend

# Start dev server
uvicorn main:app --reload --port 8000

# Run all tests
pytest

# Run a single test file
pytest tests/test_auth.py

# Run a single test
pytest tests/test_auth.py::test_login
```

Tests use an in-memory SQLite DB (no MySQL needed). The test fixtures are in `backend/tests/conftest.py`.

### Frontend

```bash
# Serve frontend with API proxy (proxies /api/* to localhost:8000)
python serve.py 3000

# Build Tailwind CSS
npm run build:css
```

### Docker (production)

```bash
docker-compose up --build
```

## Architecture

### Backend (`backend/`)

FastAPI async app with SQLAlchemy 2.0 async ORM.

- **`main.py`** — app entry point; registers routers, runs DB migrations and job import on startup
- **`config.py`** — all config via `Settings` (pydantic-settings), loaded from `.env`
- **`database.py`** — async SQLAlchemy engine; supports both MySQL (prod) and SQLite (tests/dev)
- **`routers/`** — HTTP layer only; delegates to services
- **`services/`** — business logic
- **`models/`** — SQLAlchemy ORM models (`User`, `Job`)
- **`schemas/`** — Pydantic request/response models
- **`scripts/`** — data import utilities (`import_jobs.py`, `clean_jobs.py`)

**API routes:**
- `POST /api/auth/*` — register, login (JWT)
- `GET/POST /api/jobs/*` — job listing, search, detail
- `POST /api/ai/match` — batch resume-to-job matching (Ollama)
- `POST /api/ai/optimize` — resume optimization (LLM, streaming)
- `POST /api/ai/optimize-module` — per-section streaming optimization
- `POST /api/resume/parse` — parse uploaded resume (PDF/DOCX via pdfplumber/python-docx)

**AI services:**
- `ollama_service.py` — local Ollama for job matching scores
- `llm_service.py` — resume optimization via DeepSeek or Qwen API
- `semantic_vector_service.py` — FAISS + `sentence-transformers` (BAAI/bge-small-zh-v1.5) for semantic job search

### Frontend (`pages/`, `js/`, `css/`, `assets/`)

Vanilla HTML pages with no build step (except Tailwind CSS compilation).

- `pages/home.html` — job search and listing
- `pages/job-detail.html` — job detail with AI match
- `pages/resume-editor-kinetic.html` — animated resume editor
- `pages/resume-editor-precision.html` — structured resume editor

`serve.py` acts as a dev proxy: static files are served directly, `/api/*` requests are forwarded to the backend.

### Database

- **Production**: MySQL 8.0 (via `aiomysql`)
- **Dev/Tests**: SQLite (set `DATABASE_URL=sqlite+aiosqlite:///./yesjob_dev.db` in `.env`)
- Jobs are seeded from `data/jobs.jsonl` on startup if the jobs table is empty

## Environment Setup

Copy `.env.example` to `.env`. For local dev with SQLite:

```
DATABASE_URL=sqlite+aiosqlite:///./yesjob_dev.db
SECRET_KEY=any-dev-secret
JOBS_FILE=data/jobs.jsonl
```

AI features require either a running Ollama instance or API keys for DeepSeek/Qwen.
