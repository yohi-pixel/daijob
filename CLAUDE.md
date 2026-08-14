# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

逮JOB is a job search platform with AI-powered resume matching and optimization. It has a Python/FastAPI backend and a React 18 + TypeScript frontend (in `frontend/`).

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
# Run from frontend/ directory (Vite dev server, proxies /api/* to localhost:8000)
cd frontend

# Start dev server (http://localhost:5173)
npm run dev

# Run tests
npm run test

# Production build → frontend/dist/
npm run build
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
- **`models/`** — SQLAlchemy ORM models (`User`, `Job`, `UserProfile`)
- **`schemas/`** — Pydantic request/response models
- **`scripts/`** — data import utilities (`import_jobs.py`, `clean_jobs.py`)

**API routes:**
- `POST /api/auth/*` — register, login (JWT)
- `GET/POST /api/jobs/*` — job listing, search, detail
- `POST /api/ai/match` — batch resume-to-job matching (Ollama)
- `POST /api/ai/optimize` — resume optimization (LLM, streaming)
- `POST /api/ai/optimize-module` — per-section streaming optimization
- `POST /api/ai/chat` — multi-turn conversation with pixel assistant (SSE streaming)
- `GET /api/ai/profile` — get user profile extracted from conversations
- `POST /api/ai/recommend-jobs` — RAG-based job recommendations using user profile
- `POST /api/ai/analyze-job-fit` — analyze fit between user profile and specific job (SSE streaming)
- `POST /api/resume/parse` — parse uploaded resume (PDF/DOCX via pdfplumber/python-docx)

**AI services:**
- `ollama_service.py` — local Ollama for job matching scores
- `llm_service.py` — resume optimization via DeepSeek or Qwen API
- `chat_service.py` — multi-turn conversation, profile extraction, job fit analysis
- `semantic_vector_service.py` — FAISS + `sentence-transformers` (BAAI/bge-small-zh-v1.5) for semantic job search

### Frontend (`frontend/`)

React 18 SPA: Vite + TypeScript + Tailwind CSS + React Router + zustand + TanStack Query.

- `src/pages/` — route pages: `/jobs`, `/jobs/:id`, `/saved`, `/map`, `/resume`
- `src/components/` — layout / common / jobs / map / saved / resume / pixel (Canvas sprite assistant)
- `src/stores/` — zustand stores (auth / savedJobs / resume / resumeSnapshots), persisted to localStorage
- `src/lib/` — apiClient, storage, SSE parser, resume schema compat (unifies legacy `module_type`/`type` naming)
- `src/hooks/useSSE.ts` — custom SSE hook (POST + ReadableStream; backend SSE endpoints don't work with EventSource)
- `__tests__/` — Vitest tests (quota, schema compat, SSE parsing, stores)

`vite.config.ts` proxies `/api/*` to `http://localhost:8000` in dev.

### Database

- **Production**: MySQL 8.0 (via `aiomysql`)
- **Dev/Tests**: SQLite (set `DATABASE_URL=sqlite+aiosqlite:///./yesjob_dev.db` in `backend/.env`)
- Jobs are seeded from `data/jobs.jsonl` on startup if the jobs table is empty
- Tables: `users`, `jobs`, `user_profiles` (stores conversation history and extracted profile as JSON)

## Environment Setup

Copy `.env.example` to `backend/.env`. For local dev with SQLite:

```
DATABASE_URL=sqlite+aiosqlite:///./yesjob_dev.db
SECRET_KEY=any-dev-secret
JOBS_FILE=../data/jobs.jsonl
```

Note: `JOBS_FILE` is relative to the `backend/` directory, so `../data/jobs.jsonl` points to the repo-root data file.

AI features require either a running Ollama instance or API keys for DeepSeek/Qwen.
