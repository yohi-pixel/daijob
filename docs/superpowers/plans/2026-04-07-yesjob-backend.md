# YesJob 后端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建 YesJob FastAPI 后端，包含职位 API、用户认证、AI 匹配与简历优化接口，并通过完整测试套件验证。

**Architecture:** 单体 FastAPI 应用，三个路由模块（/auth, /jobs, /ai），SQLAlchemy 2.x async ORM 连接 PostgreSQL（测试用 SQLite in-memory）。AI 层混合 Ollama 本地推理（匹配评分）和 DeepSeek/Qwen 远程 API（简历优化），均有 fallback 策略。

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.x async, asyncpg (prod) / aiosqlite (test), python-jose, passlib[bcrypt], httpx, pytest-asyncio, jsonlines

---

## Task 1: Project Scaffold

**Files:**
- Create `D:/ayohi/YesJob/backend/requirements.txt`
- Create `D:/ayohi/YesJob/backend/.env.example`
- Create `D:/ayohi/YesJob/backend/pytest.ini`
- Create `D:/ayohi/YesJob/backend/config.py`
- Create `D:/ayohi/YesJob/backend/database.py`
- Create `D:/ayohi/YesJob/backend/main.py`
- Create `D:/ayohi/YesJob/backend/tests/conftest.py`
- Create `D:/ayohi/YesJob/backend/tests/test_health.py`

- [ ] Create `D:/ayohi/YesJob/backend/requirements.txt`:

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
asyncpg==0.29.0
aiosqlite==0.20.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.0
openai==1.30.1
jsonlines==4.0.0
python-dotenv==1.0.1
pydantic-settings==2.2.1
pytest==8.2.0
pytest-asyncio==0.23.6
```

- [ ] Create `D:/ayohi/YesJob/backend/.env.example`:

```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/yesjob
SECRET_KEY=change-me-to-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
QWEN_API_KEY=sk-...
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
JOBS_FILE=data/jobs.jsonl
```

- [ ] Create `D:/ayohi/YesJob/backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] Create `D:/ayohi/YesJob/backend/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/yesjob"
    SECRET_KEY: str = "dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    QWEN_API_KEY: str = ""
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_MODEL: str = "qwen-plus"
    JOBS_FILE: str = "data/jobs.jsonl"

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] Create `D:/ayohi/YesJob/backend/database.py`:

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] Create `D:/ayohi/YesJob/backend/main.py`:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import Base, engine
from config import settings
from routers import auth, jobs, ai
import asyncio


async def import_jobs_if_empty(jobs_file: str):
    from scripts.import_jobs import run_import
    await run_import(jobs_file)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await import_jobs_if_empty(settings.JOBS_FILE)
    yield


app = FastAPI(title="YesJob API", version="1.0.0", lifespan=lifespan)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] Create `D:/ayohi/YesJob/backend/tests/__init__.py` (empty file).

- [ ] Create `D:/ayohi/YesJob/backend/tests/conftest.py`:

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

# Import all models so Base.metadata knows about them
from models import user, job  # noqa: F401
from database import Base, get_db
from main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    TestSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

- [ ] Create `D:/ayohi/YesJob/backend/tests/test_health.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] Run tests and verify:

```bash
cd D:/ayohi/YesJob/backend
pip install -r requirements.txt
pytest tests/test_health.py -v
```

Expected output:
```
tests/test_health.py::test_health PASSED
1 passed in ...
```

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add backend/
git commit -m "task 1: project scaffold — FastAPI app, config, database, health check, test fixtures"
```

---

## Task 2: ORM Models

**Files:**
- Create `D:/ayohi/YesJob/backend/models/__init__.py`
- Create `D:/ayohi/YesJob/backend/models/user.py`
- Create `D:/ayohi/YesJob/backend/models/job.py`
- Create `D:/ayohi/YesJob/backend/tests/test_models.py`

- [ ] Create `D:/ayohi/YesJob/backend/models/__init__.py` (empty).

- [ ] Create `D:/ayohi/YesJob/backend/models/user.py`:

```python
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

- [ ] Create `D:/ayohi/YesJob/backend/models/job.py`:

```python
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    company: Mapped[Optional[str]] = mapped_column(String(200))
    title: Mapped[Optional[str]] = mapped_column(String(300), index=True)
    recruit_type: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    job_category: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    job_function: Mapped[Optional[str]] = mapped_column(String(100))
    work_city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    work_cities: Mapped[Optional[list]] = mapped_column(JSON)
    team_intro: Mapped[Optional[str]] = mapped_column(Text)
    responsibilities: Mapped[Optional[str]] = mapped_column(Text)
    requirements: Mapped[Optional[str]] = mapped_column(Text)
    bonus_points: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list]] = mapped_column(JSON)
    publish_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    detail_url: Mapped[Optional[str]] = mapped_column(String(500))
    fetched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    source_page: Mapped[Optional[str]] = mapped_column(String(20))
```

- [ ] Create `D:/ayohi/YesJob/backend/tests/test_models.py`:

```python
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_tables_created(db_engine):
    async with db_engine.connect() as conn:
        result = await conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table'")
        )
        tables = {row[0] for row in result.fetchall()}
    assert "users" in tables
    assert "jobs" in tables


@pytest.mark.asyncio
async def test_user_insert(db_session):
    from models.user import User
    user = User(username="testuser", email="test@example.com", hashed_password="hashed")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    assert user.id is not None
    assert user.email == "test@example.com"


@pytest.mark.asyncio
async def test_job_insert(db_session):
    from models.job import Job
    job = Job(
        job_id="99999",
        company="TestCo",
        title="测试工程师",
        recruit_type="实习",
        job_category="技术类",
        work_city="北京",
        work_cities=["北京"],
        tags=[],
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    assert job.id is not None
    assert job.work_cities == ["北京"]
```

- [ ] Run tests:

```bash
cd D:/ayohi/YesJob/backend
pytest tests/test_models.py -v
```

Expected output:
```
tests/test_models.py::test_tables_created PASSED
tests/test_models.py::test_user_insert PASSED
tests/test_models.py::test_job_insert PASSED
3 passed in ...
```

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add backend/models/
git add backend/tests/test_models.py
git commit -m "task 2: ORM models — User and Job with SQLAlchemy 2.x mapped_column"
```

---

## Task 3: Job Import Script

**Files:**
- Create `D:/ayohi/YesJob/backend/scripts/__init__.py`
- Create `D:/ayohi/YesJob/backend/scripts/import_jobs.py`
- Create `D:/ayohi/YesJob/backend/tests/test_import.py`

- [ ] Create `D:/ayohi/YesJob/backend/scripts/__init__.py` (empty).

- [ ] Create `D:/ayohi/YesJob/backend/scripts/import_jobs.py`:

```python
import asyncio
import json
from datetime import datetime
from pathlib import Path
from sqlalchemy import select, func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from database import Base
from models.job import Job
from config import settings


def parse_publish_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return None


def parse_fetched_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def record_to_dict(record: dict) -> dict:
    return {
        "job_id": str(record.get("job_id", "")),
        "company": record.get("company"),
        "title": record.get("title"),
        "recruit_type": record.get("recruit_type"),
        "job_category": record.get("job_category"),
        "job_function": record.get("job_function"),
        "work_city": record.get("work_city"),
        "work_cities": record.get("work_cities") or [],
        "team_intro": record.get("team_intro") or "",
        "responsibilities": record.get("responsibilities") or "",
        "requirements": record.get("requirements") or "",
        "bonus_points": record.get("bonus_points") or "",
        "tags": record.get("tags") or [],
        "publish_time": parse_publish_time(record.get("publish_time")),
        "fetched_at": parse_fetched_at(record.get("fetched_at")),
        "detail_url": record.get("detail_url"),
        "source_page": record.get("source_page"),
    }


async def run_import(jobs_file: str, session: AsyncSession | None = None):
    """Import jobs from JSONL file. Idempotent — skips if table already has rows."""
    file_path = Path(jobs_file)
    if not file_path.exists():
        print(f"[import_jobs] File not found: {file_path}, skipping.")
        return

    own_session = session is None
    if own_session:
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        session = SessionLocal()

    try:
        count_result = await session.execute(select(func.count()).select_from(Job))
        existing = count_result.scalar()
        if existing and existing > 0:
            print(f"[import_jobs] Table already has {existing} rows, skipping import.")
            return

        batch = []
        total = 0
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue
                batch.append(record_to_dict(record))
                if len(batch) >= 500:
                    await session.execute(sqlite_insert(Job).prefix_with("OR IGNORE"), batch)
                    await session.commit()
                    total += len(batch)
                    batch = []

        if batch:
            await session.execute(sqlite_insert(Job).prefix_with("OR IGNORE"), batch)
            await session.commit()
            total += len(batch)

        print(f"[import_jobs] Imported {total} jobs.")
    finally:
        if own_session:
            await session.close()
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_import(settings.JOBS_FILE))
```

- [ ] Create `D:/ayohi/YesJob/backend/tests/test_import.py`:

```python
import json
import pytest
import tempfile
import os
from sqlalchemy import select, func
from models.job import Job
from scripts.import_jobs import run_import

SAMPLE_JOBS = [
    {
        "company": "哔哩哔哩",
        "job_id": "16420",
        "title": "大模型运营实习生",
        "recruit_type": "实习",
        "job_category": "产品运营类",
        "job_function": "实习",
        "work_city": "上海",
        "work_cities": ["上海"],
        "team_intro": "",
        "responsibilities": "负责大模型产品运营",
        "requirements": "在校学生",
        "bonus_points": "有编程能力",
        "tags": [],
        "publish_time": "2024-06-27 11:02:35",
        "detail_url": "https://jobs.bilibili.com/campus/positions/16420",
        "fetched_at": "2026-03-14T12:10:34.133358+00:00",
        "source_page": "31",
    },
    {
        "company": "字节跳动",
        "job_id": "20001",
        "title": "后端开发实习生",
        "recruit_type": "实习",
        "job_category": "技术类",
        "job_function": "实习",
        "work_city": "北京",
        "work_cities": ["北京"],
        "team_intro": "",
        "responsibilities": "参与后端服务开发",
        "requirements": "熟悉Python或Go",
        "bonus_points": "",
        "tags": ["Python", "Go"],
        "publish_time": "2024-07-01 09:00:00",
        "detail_url": "https://jobs.bytedance.com/20001",
        "fetched_at": "2026-03-15T08:00:00+00:00",
        "source_page": "1",
    },
    {
        "company": "腾讯",
        "job_id": "30001",
        "title": "前端开发工程师",
        "recruit_type": "校招",
        "job_category": "技术类",
        "job_function": "校招",
        "work_city": "深圳",
        "work_cities": ["深圳"],
        "team_intro": "",
        "responsibilities": "负责前端开发",
        "requirements": "熟悉React或Vue",
        "bonus_points": "",
        "tags": [],
        "publish_time": "2024-08-01 10:00:00",
        "detail_url": "https://careers.tencent.com/30001",
        "fetched_at": "2026-03-16T10:00:00+00:00",
        "source_page": "2",
    },
]


@pytest.fixture
def sample_jsonl(tmp_path):
    path = tmp_path / "sample_jobs.jsonl"
    with open(path, "w", encoding="utf-8") as f:
        for job in SAMPLE_JOBS:
            f.write(json.dumps(job, ensure_ascii=False) + "\n")
    return str(path)


@pytest.mark.asyncio
async def test_import_inserts_jobs(db_session, sample_jsonl):
    await run_import(sample_jsonl, session=db_session)
    result = await db_session.execute(select(func.count()).select_from(Job))
    count = result.scalar()
    assert count == 3


@pytest.mark.asyncio
async def test_import_is_idempotent(db_session, sample_jsonl):
    await run_import(sample_jsonl, session=db_session)
    await run_import(sample_jsonl, session=db_session)
    result = await db_session.execute(select(func.count()).select_from(Job))
    count = result.scalar()
    assert count == 3


@pytest.mark.asyncio
async def test_import_parses_dates(db_session, sample_jsonl):
    await run_import(sample_jsonl, session=db_session)
    result = await db_session.execute(select(Job).where(Job.job_id == "16420"))
    job = result.scalar_one()
    assert job.publish_time is not None
    assert job.publish_time.year == 2024
    assert job.fetched_at is not None


@pytest.mark.asyncio
async def test_import_missing_file(db_session):
    await run_import("/nonexistent/path/jobs.jsonl", session=db_session)
    result = await db_session.execute(select(func.count()).select_from(Job))
    count = result.scalar()
    assert count == 0
```

- [ ] Run tests:

```bash
cd D:/ayohi/YesJob/backend
pytest tests/test_import.py -v
```

Expected output:
```
tests/test_import.py::test_import_inserts_jobs PASSED
tests/test_import.py::test_import_is_idempotent PASSED
tests/test_import.py::test_import_parses_dates PASSED
tests/test_import.py::test_import_missing_file PASSED
4 passed in ...
```

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add backend/scripts/ backend/tests/test_import.py
git commit -m "task 3: job import script — idempotent JSONL loader with batch inserts"
```

---

---

## Task 4: Jobs API

**Files:**
- Create `D:/ayohi/YesJob/backend/schemas/__init__.py`
- Create `D:/ayohi/YesJob/backend/schemas/job.py`
- Create `D:/ayohi/YesJob/backend/services/__init__.py`
- Create `D:/ayohi/YesJob/backend/services/job_service.py`
- Create `D:/ayohi/YesJob/backend/routers/__init__.py`
- Create `D:/ayohi/YesJob/backend/routers/jobs.py`
- Create `D:/ayohi/YesJob/backend/tests/test_jobs.py`

- [ ] Create `D:/ayohi/YesJob/backend/schemas/__init__.py` (empty).

- [ ] Create `D:/ayohi/YesJob/backend/schemas/job.py`:

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class JobSummary(BaseModel):
    id: int
    job_id: str
    company: Optional[str]
    title: Optional[str]
    recruit_type: Optional[str]
    job_category: Optional[str]
    work_city: Optional[str]
    publish_time: Optional[datetime]
    detail_url: Optional[str]

    model_config = {"from_attributes": True}


class JobDetail(BaseModel):
    id: int
    job_id: str
    company: Optional[str]
    title: Optional[str]
    recruit_type: Optional[str]
    job_category: Optional[str]
    job_function: Optional[str]
    work_city: Optional[str]
    work_cities: Optional[list]
    team_intro: Optional[str]
    responsibilities: Optional[str]
    requirements: Optional[str]
    bonus_points: Optional[str]
    tags: Optional[list]
    publish_time: Optional[datetime]
    detail_url: Optional[str]
    fetched_at: Optional[datetime]

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[JobSummary]


class FiltersResponse(BaseModel):
    cities: list[str]
    recruit_types: list[str]
    job_categories: list[str]
```

- [ ] Create `D:/ayohi/YesJob/backend/services/__init__.py` (empty).

- [ ] Create `D:/ayohi/YesJob/backend/services/job_service.py`:

```python
from typing import Optional
from sqlalchemy import select, func, distinct, nullslast
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from models.job import Job
from schemas.job import JobListResponse, JobDetail, FiltersResponse, JobSummary


async def list_jobs(
    db: AsyncSession,
    q: Optional[str] = None,
    city: Optional[str] = None,
    recruit_type: Optional[str] = None,
    job_category: Optional[str] = None,
    company: Optional[str] = None,
    sort: str = "latest",
    page: int = 1,
    page_size: int = 20,
) -> JobListResponse:
    page_size = min(page_size, 100)
    stmt = select(Job)
    if q:
        stmt = stmt.where(Job.title.ilike(f"%{q}%"))
    if city:
        stmt = stmt.where(Job.work_city == city)
    if recruit_type:
        stmt = stmt.where(Job.recruit_type == recruit_type)
    if job_category:
        stmt = stmt.where(Job.job_category == job_category)
    if company:
        stmt = stmt.where(Job.company.ilike(f"%{company}%"))
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    if sort == "latest":
        stmt = stmt.order_by(nullslast(Job.publish_time.desc()))
    else:
        stmt = stmt.order_by(Job.id.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return JobListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[JobSummary.model_validate(j) for j in jobs],
    )


async def get_job(db: AsyncSession, job_id: int) -> JobDetail:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobDetail.model_validate(job)


async def get_filters(db: AsyncSession) -> FiltersResponse:
    cities_result = await db.execute(
        select(distinct(Job.work_city)).where(Job.work_city.isnot(None)).order_by(Job.work_city)
    )
    cities = [r[0] for r in cities_result.fetchall() if r[0]]
    types_result = await db.execute(
        select(distinct(Job.recruit_type)).where(Job.recruit_type.isnot(None)).order_by(Job.recruit_type)
    )
    recruit_types = [r[0] for r in types_result.fetchall() if r[0]]
    cats_result = await db.execute(
        select(distinct(Job.job_category)).where(Job.job_category.isnot(None)).order_by(Job.job_category)
    )
    job_categories = [r[0] for r in cats_result.fetchall() if r[0]]
    return FiltersResponse(cities=cities, recruit_types=recruit_types, job_categories=job_categories)
```

- [ ] Create `D:/ayohi/YesJob/backend/routers/__init__.py` (empty).

- [ ] Create `D:/ayohi/YesJob/backend/routers/jobs.py`:

```python
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from services.job_service import list_jobs, get_job, get_filters
from schemas.job import JobListResponse, JobDetail, FiltersResponse

router = APIRouter()


@router.get("", response_model=JobListResponse)
async def get_jobs(
    q: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    recruit_type: Optional[str] = Query(None),
    job_category: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    sort: str = Query("latest", pattern="^(latest|relevance)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await list_jobs(db, q=q, city=city, recruit_type=recruit_type,
                           job_category=job_category, company=company,
                           sort=sort, page=page, page_size=page_size)


@router.get("/meta/filters", response_model=FiltersResponse)
async def filters_meta(db: AsyncSession = Depends(get_db)):
    return await get_filters(db)


@router.get("/{job_id}", response_model=JobDetail)
async def job_detail(job_id: int, db: AsyncSession = Depends(get_db)):
    return await get_job(db, job_id)
```

- [ ] Create `D:/ayohi/YesJob/backend/tests/test_jobs.py`:

```python
import pytest
from datetime import datetime
from models.job import Job

SEED_JOBS = [
    Job(job_id="J001", company="哔哩哔哩", title="大模型运营实习生",
        recruit_type="实习", job_category="产品运营类", work_city="上海",
        work_cities=["上海"], responsibilities="负责大模型产品运营",
        requirements="在校学生", bonus_points="有编程能力", tags=[],
        publish_time=datetime(2024, 6, 27, 11, 2, 35),
        detail_url="https://jobs.bilibili.com/campus/positions/16420"),
    Job(job_id="J002", company="字节跳动", title="后端开发实习生",
        recruit_type="实习", job_category="技术类", work_city="北京",
        work_cities=["北京"], responsibilities="参与后端服务开发",
        requirements="熟悉Python或Go", bonus_points="", tags=["Python"],
        publish_time=datetime(2024, 7, 1, 9, 0, 0),
        detail_url="https://jobs.bytedance.com/20001"),
    Job(job_id="J003", company="腾讯", title="前端开发工程师",
        recruit_type="校招", job_category="技术类", work_city="深圳",
        work_cities=["深圳"], responsibilities="负责前端开发",
        requirements="熟悉React或Vue", bonus_points="", tags=[],
        publish_time=datetime(2024, 8, 1, 10, 0, 0),
        detail_url="https://careers.tencent.com/30001"),
]


@pytest.fixture(autouse=True)
async def seed_jobs(db_session):
    for j in SEED_JOBS:
        db_session.add(j)
    await db_session.commit()


@pytest.mark.asyncio
async def test_list_jobs_default(client):
    r = await client.get("/jobs")
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 3
    assert len(d["items"]) == 3


@pytest.mark.asyncio
async def test_list_jobs_filter_city(client):
    r = await client.get("/jobs", params={"city": "北京"})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 1
    assert d["items"][0]["company"] == "字节跳动"


@pytest.mark.asyncio
async def test_list_jobs_filter_recruit_type(client):
    r = await client.get("/jobs", params={"recruit_type": "校招"})
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["company"] == "腾讯"


@pytest.mark.asyncio
async def test_list_jobs_filter_category(client):
    r = await client.get("/jobs", params={"job_category": "技术类"})
    assert r.status_code == 200
    assert r.json()["total"] == 2


@pytest.mark.asyncio
async def test_list_jobs_search(client):
    r = await client.get("/jobs", params={"q": "前端"})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 1
    assert d["items"][0]["title"] == "前端开发工程师"


@pytest.mark.asyncio
async def test_list_jobs_search_no_results(client):
    r = await client.get("/jobs", params={"q": "不存在XYZ"})
    assert r.status_code == 200
    assert r.json()["total"] == 0


@pytest.mark.asyncio
async def test_list_jobs_pagination(client):
    r = await client.get("/jobs", params={"page": 1, "page_size": 2})
    assert r.status_code == 200
    d = r.json()
    assert len(d["items"]) == 2
    assert d["total"] == 3


@pytest.mark.asyncio
async def test_list_jobs_sort_latest(client):
    r = await client.get("/jobs", params={"sort": "latest"})
    assert r.status_code == 200
    assert r.json()["items"][0]["company"] == "腾讯"


@pytest.mark.asyncio
async def test_job_detail(client, db_session):
    from sqlalchemy import select
    result = await db_session.execute(select(Job).where(Job.job_id == "J001"))
    job = result.scalar_one()
    r = await client.get(f"/jobs/{job.id}")
    assert r.status_code == 200
    d = r.json()
    assert d["job_id"] == "J001"
    assert d["work_cities"] == ["上海"]


@pytest.mark.asyncio
async def test_job_detail_not_found(client):
    r = await client.get("/jobs/99999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_filters_meta(client):
    r = await client.get("/jobs/meta/filters")
    assert r.status_code == 200
    d = r.json()
    assert set(d["cities"]) == {"上海", "北京", "深圳"}
    assert set(d["recruit_types"]) == {"实习", "校招"}
    assert set(d["job_categories"]) == {"产品运营类", "技术类"}
```

- [ ] Run tests:

```bash
cd D:/ayohi/YesJob/backend
pytest tests/test_jobs.py -v
```

Expected output:
```
tests/test_jobs.py::test_list_jobs_default PASSED
tests/test_jobs.py::test_list_jobs_filter_city PASSED
tests/test_jobs.py::test_list_jobs_filter_recruit_type PASSED
tests/test_jobs.py::test_list_jobs_filter_category PASSED
tests/test_jobs.py::test_list_jobs_search PASSED
tests/test_jobs.py::test_list_jobs_search_no_results PASSED
tests/test_jobs.py::test_list_jobs_pagination PASSED
tests/test_jobs.py::test_list_jobs_sort_latest PASSED
tests/test_jobs.py::test_job_detail PASSED
tests/test_jobs.py::test_job_detail_not_found PASSED
tests/test_jobs.py::test_filters_meta PASSED
11 passed in ...
```

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add backend/schemas/job.py backend/services/job_service.py backend/routers/jobs.py backend/tests/test_jobs.py
git commit -m "task 4: jobs API — list/filter/search/detail/filters-meta endpoints with tests"
```

---

## Task 5: Auth API

**Files:**
- Create `D:/ayohi/YesJob/backend/schemas/auth.py`
- Create `D:/ayohi/YesJob/backend/services/auth_service.py`
- Create `D:/ayohi/YesJob/backend/routers/auth.py`
- Create `D:/ayohi/YesJob/backend/tests/test_auth.py`

- [ ] Create `D:/ayohi/YesJob/backend/schemas/auth.py`:

```python
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
```

- [ ] Create `D:/ayohi/YesJob/backend/services/auth_service.py`:

```python
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from config import settings
from database import get_db
from models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> int:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = int(user_id_str)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user_id
```

- [ ] Create `D:/ayohi/YesJob/backend/routers/auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models.user import User
from schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from services.auth_service import hash_password, verify_password, create_token
from config import settings

router = APIRouter()


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"message": "User created", "user_id": user.id}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
```

- [ ] Create `D:/ayohi/YesJob/backend/tests/test_auth.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_register_success(client):
    r = await client.post("/auth/register", json={
        "username": "testuser", "email": "test@example.com", "password": "secure123"
    })
    assert r.status_code == 201
    d = r.json()
    assert d["message"] == "User created"
    assert isinstance(d["user_id"], int)


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = {"username": "u", "email": "dup@example.com", "password": "pass123"}
    await client.post("/auth/register", json=payload)
    r = await client.post("/auth/register", json=payload)
    assert r.status_code == 400
    assert "already registered" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post("/auth/register", json={
        "username": "loginuser", "email": "login@example.com", "password": "mypassword"
    })
    r = await client.post("/auth/login", json={
        "email": "login@example.com", "password": "mypassword"
    })
    assert r.status_code == 200
    d = r.json()
    assert "access_token" in d
    assert d["token_type"] == "bearer"
    assert isinstance(d["expires_in"], int)


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/auth/register", json={
        "username": "pwuser", "email": "pw@example.com", "password": "correctpassword"
    })
    r = await client.post("/auth/login", json={
        "email": "pw@example.com", "password": "wrongpassword"
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    r = await client.post("/auth/login", json={
        "email": "nobody@example.com", "password": "anything"
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_token_is_valid_jwt(client):
    await client.post("/auth/register", json={
        "username": "jwtuser", "email": "jwt@example.com", "password": "jwtpass"
    })
    login_resp = await client.post("/auth/login", json={
        "email": "jwt@example.com", "password": "jwtpass"
    })
    token = login_resp.json()["access_token"]
    from jose import jwt
    from config import settings
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert "sub" in payload
    assert int(payload["sub"]) > 0
```

- [ ] Run tests:

```bash
cd D:/ayohi/YesJob/backend
pytest tests/test_auth.py -v
```

Expected output:
```
tests/test_auth.py::test_register_success PASSED
tests/test_auth.py::test_register_duplicate_email PASSED
tests/test_auth.py::test_login_success PASSED
tests/test_auth.py::test_login_wrong_password PASSED
tests/test_auth.py::test_login_nonexistent_user PASSED
tests/test_auth.py::test_token_is_valid_jwt PASSED
6 passed in ...
```

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add backend/schemas/auth.py backend/services/auth_service.py backend/routers/auth.py backend/tests/test_auth.py
git commit -m "task 5: auth API — register/login with JWT, bcrypt, duplicate/wrong-password guards"
```

---

## Task 6: AI Match Endpoint

**Files:**
- Create `D:/ayohi/YesJob/backend/schemas/ai.py`
- Create `D:/ayohi/YesJob/backend/services/ollama_service.py`
- Create `D:/ayohi/YesJob/backend/routers/ai.py` (match only; optimize added in Task 7)
- Create `D:/ayohi/YesJob/backend/tests/test_ai_match.py`

- [ ] Create `D:/ayohi/YesJob/backend/schemas/ai.py`:

```python
from typing import Optional
from pydantic import BaseModel


class MatchRequest(BaseModel):
    resume_text: str
    job_ids: list[int]


class MatchResponse(BaseModel):
    scores: dict[str, Optional[int]]


class OptimizeRequest(BaseModel):
    resume_text: str
    job_id: int


class OptimizeResponse(BaseModel):
    optimized_resume: str
    suggestions: list[str]
```

- [ ] Create `D:/ayohi/YesJob/backend/services/ollama_service.py`:

```python
import httpx
from config import settings

MATCH_PROMPT_TEMPLATE = (
    "你是一个招聘助手。请评估以下简历与职位的匹配程度，返回 0-100 的整数分数。\n\n"
    "职位信息：\n"
    "- 职位名称：{title}\n"
    "- 职位类别：{job_category}\n"
    "- 职责：{responsibilities}\n"
    "- 要求：{requirements}\n\n"
    "求职者简历：\n{resume_text}\n\n"
    "请只返回一个 0-100 的整数，不要有任何其他文字。"
)


async def score_single(
    resume_text: str,
    title: str,
    job_category: str,
    responsibilities: str,
    requirements: str,
) -> int | None:
    prompt = MATCH_PROMPT_TEMPLATE.format(
        title=title,
        job_category=job_category,
        responsibilities=responsibilities,
        requirements=requirements,
        resume_text=resume_text,
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            response.raise_for_status()
            text = response.json()["response"].strip()
            return int(text)
    except Exception:
        return None


async def batch_match(
    resume_text: str,
    jobs: list[dict],
) -> dict[str, int | None]:
    results: dict[str, int | None] = {}
    for job in jobs:
        score = await score_single(
            resume_text=resume_text,
            title=job.get("title") or "",
            job_category=job.get("job_category") or "",
            responsibilities=job.get("responsibilities") or "",
            requirements=job.get("requirements") or "",
        )
        results[str(job["id"])] = score
    return results
```

- [ ] Create `D:/ayohi/YesJob/backend/routers/ai.py` (match endpoint only — optimize added in Task 7):

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models.job import Job
from schemas.ai import MatchRequest, MatchResponse, OptimizeRequest, OptimizeResponse
from services.auth_service import get_current_user
from services.ollama_service import batch_match

router = APIRouter()


@router.post("/match", response_model=MatchResponse)
async def match_jobs(
    body: MatchRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.job_ids) > 50:
        raise HTTPException(status_code=400, detail="TOO_MANY_JOBS")
    if len(body.resume_text) > 5000:
        raise HTTPException(status_code=400, detail="RESUME_TOO_LONG")

    result = await db.execute(select(Job).where(Job.id.in_(body.job_ids)))
    jobs = result.scalars().all()
    job_dicts = [
        {
            "id": j.id,
            "title": j.title or "",
            "job_category": j.job_category or "",
            "responsibilities": j.responsibilities or "",
            "requirements": j.requirements or "",
        }
        for j in jobs
    ]
    scores = await batch_match(body.resume_text, job_dicts)
    for jid in body.job_ids:
        if str(jid) not in scores:
            scores[str(jid)] = None
    return MatchResponse(scores=scores)
```

- [ ] Create `D:/ayohi/YesJob/backend/tests/test_ai_match.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime
from models.job import Job
from models.user import User
from services.auth_service import hash_password, create_token


@pytest.fixture
async def seeded_job(db_session):
    job = Job(
        job_id="AI001", company="测试公司", title="算法工程师",
        recruit_type="实习", job_category="技术类", work_city="北京",
        work_cities=["北京"], responsibilities="负责模型训练",
        requirements="熟悉PyTorch", bonus_points="", tags=[],
        publish_time=datetime(2024, 9, 1),
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    return job


@pytest.fixture
async def auth_headers(db_session):
    user = User(username="aiuser", email="ai@example.com",
                hashed_password=hash_password("pass"))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_token(user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_match_returns_scores(client, seeded_job, auth_headers):
    with patch("routers.ai.batch_match", new_callable=AsyncMock) as mock_match:
        mock_match.return_value = {str(seeded_job.id): 85}
        r = await client.post(
            "/ai/match",
            json={"resume_text": "我熟悉PyTorch和深度学习", "job_ids": [seeded_job.id]},
            headers=auth_headers,
        )
    assert r.status_code == 200
    assert r.json()["scores"][str(seeded_job.id)] == 85


@pytest.mark.asyncio
async def test_match_ollama_failure_returns_null(client, seeded_job, auth_headers):
    with patch("routers.ai.batch_match", new_callable=AsyncMock) as mock_match:
        mock_match.return_value = {str(seeded_job.id): None}
        r = await client.post(
            "/ai/match",
            json={"resume_text": "简历内容", "job_ids": [seeded_job.id]},
            headers=auth_headers,
        )
    assert r.status_code == 200
    assert r.json()["scores"][str(seeded_job.id)] is None


@pytest.mark.asyncio
async def test_match_too_many_jobs(client, auth_headers):
    r = await client.post(
        "/ai/match",
        json={"resume_text": "简历", "job_ids": list(range(1, 52))},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "TOO_MANY_JOBS"


@pytest.mark.asyncio
async def test_match_resume_too_long(client, seeded_job, auth_headers):
    r = await client.post(
        "/ai/match",
        json={"resume_text": "x" * 5001, "job_ids": [seeded_job.id]},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "RESUME_TOO_LONG"


@pytest.mark.asyncio
async def test_match_requires_auth(client, seeded_job):
    r = await client.post(
        "/ai/match",
        json={"resume_text": "简历", "job_ids": [seeded_job.id]},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_match_nonexistent_job_returns_null(client, auth_headers):
    with patch("routers.ai.batch_match", new_callable=AsyncMock) as mock_match:
        mock_match.return_value = {}
        r = await client.post(
            "/ai/match",
            json={"resume_text": "简历", "job_ids": [99999]},
            headers=auth_headers,
        )
    assert r.status_code == 200
    assert r.json()["scores"]["99999"] is None
```

- [ ] Run tests:

```bash
cd D:/ayohi/YesJob/backend
pytest tests/test_ai_match.py -v
```

Expected output:
```
tests/test_ai_match.py::test_match_returns_scores PASSED
tests/test_ai_match.py::test_match_ollama_failure_returns_null PASSED
tests/test_ai_match.py::test_match_too_many_jobs PASSED
tests/test_ai_match.py::test_match_resume_too_long PASSED
tests/test_ai_match.py::test_match_requires_auth PASSED
tests/test_ai_match.py::test_match_nonexistent_job_returns_null PASSED
6 passed in ...
```

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add backend/schemas/ai.py backend/services/ollama_service.py backend/routers/ai.py backend/tests/test_ai_match.py
git commit -m "task 6: AI match endpoint — Ollama scoring with null fallback, auth guard, validation"
```

---

## Task 7: AI Optimize Endpoint

**Files:**
- Create `D:/ayohi/YesJob/backend/services/llm_service.py`
- Modify `D:/ayohi/YesJob/backend/routers/ai.py` (add optimize endpoint)
- Create `D:/ayohi/YesJob/backend/tests/test_ai_optimize.py`

- [ ] Create `D:/ayohi/YesJob/backend/services/llm_service.py`:

```python
import json
import re
from openai import AsyncOpenAI
from fastapi import HTTPException
from config import settings

OPTIMIZE_PROMPT_TEMPLATE = (
    "你是一位专业的简历优化顾问，擅长为中国互联网大厂校招/实习生优化简历。\n\n"
    "目标职位：\n"
    "- 公司：{company}\n"
    "- 职位：{title}\n"
    "- 职责要求：{responsibilities}\n"
    "- 岗位要求：{requirements}\n"
    "- 加分项：{bonus_points}\n\n"
    "原始简历：\n{resume_text}\n\n"
    "请根据该职位的要求，对简历进行优化重写。要求：\n"
    "1. 保留真实信息，不虚构经历\n"
    "2. 用 STAR 法则重写项目/实习经历\n"
    "3. 突出与该职位相关的技能和经验\n"
    "4. 添加量化指标（如有可能）\n"
    "5. 使用简洁专业的语言\n"
    "6. 输出格式为 Markdown\n\n"
    '请输出优化后的简历内容，并在最后附上 3-5 条优化说明（以 JSON 数组格式输出，key 为 "suggestions"）。'
)


def _extract_suggestions(text: str) -> tuple[str, list[str]]:
    pattern = r'\{"suggestions"\s*:\s*(\[.*?\])\s*\}'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            suggestions = json.loads(match.group(1))
            resume_part = text[:match.start()].strip()
            return resume_part, suggestions
        except json.JSONDecodeError:
            pass
    return text.strip(), []


async def _call_llm(client: AsyncOpenAI, model: str, prompt: str) -> str:
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return response.choices[0].message.content or ""


async def optimize_resume(
    resume_text: str,
    company: str,
    title: str,
    responsibilities: str,
    requirements: str,
    bonus_points: str,
) -> tuple[str, list[str]]:
    prompt = OPTIMIZE_PROMPT_TEMPLATE.format(
        company=company,
        title=title,
        responsibilities=responsibilities,
        requirements=requirements,
        bonus_points=bonus_points,
        resume_text=resume_text,
    )
    if settings.DEEPSEEK_API_KEY:
        try:
            client = AsyncOpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url=settings.DEEPSEEK_BASE_URL,
            )
            text = await _call_llm(client, "deepseek-chat", prompt)
            return _extract_suggestions(text)
        except Exception:
            pass
    if settings.QWEN_API_KEY:
        try:
            client = AsyncOpenAI(
                api_key=settings.QWEN_API_KEY,
                base_url=settings.QWEN_BASE_URL,
            )
            text = await _call_llm(client, settings.QWEN_MODEL, prompt)
            return _extract_suggestions(text)
        except Exception:
            pass
    raise HTTPException(status_code=503, detail="AI service unavailable")
```

- [ ] Modify `D:/ayohi/YesJob/backend/routers/ai.py` — replace the entire file to add the optimize endpoint:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models.job import Job
from schemas.ai import MatchRequest, MatchResponse, OptimizeRequest, OptimizeResponse
from services.auth_service import get_current_user
from services.ollama_service import batch_match
from services.llm_service import optimize_resume

router = APIRouter()


@router.post("/match", response_model=MatchResponse)
async def match_jobs(
    body: MatchRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.job_ids) > 50:
        raise HTTPException(status_code=400, detail="TOO_MANY_JOBS")
    if len(body.resume_text) > 5000:
        raise HTTPException(status_code=400, detail="RESUME_TOO_LONG")
    result = await db.execute(select(Job).where(Job.id.in_(body.job_ids)))
    jobs = result.scalars().all()
    job_dicts = [
        {
            "id": j.id,
            "title": j.title or "",
            "job_category": j.job_category or "",
            "responsibilities": j.responsibilities or "",
            "requirements": j.requirements or "",
        }
        for j in jobs
    ]
    scores = await batch_match(body.resume_text, job_dicts)
    for jid in body.job_ids:
        if str(jid) not in scores:
            scores[str(jid)] = None
    return MatchResponse(scores=scores)


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_job(
    body: OptimizeRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.resume_text) > 5000:
        raise HTTPException(status_code=400, detail="RESUME_TOO_LONG")
    result = await db.execute(select(Job).where(Job.id == body.job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    optimized, suggestions = await optimize_resume(
        resume_text=body.resume_text,
        company=job.company or "",
        title=job.title or "",
        responsibilities=job.responsibilities or "",
        requirements=job.requirements or "",
        bonus_points=job.bonus_points or "",
    )
    return OptimizeResponse(optimized_resume=optimized, suggestions=suggestions)
```

- [ ] Create `D:/ayohi/YesJob/backend/tests/test_ai_optimize.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime
from models.job import Job
from models.user import User
from services.auth_service import hash_password, create_token


@pytest.fixture
async def seeded_job(db_session):
    job = Job(
        job_id="OPT001", company="哔哩哔哩", title="产品经理实习生",
        recruit_type="实习", job_category="产品运营类", work_city="上海",
        work_cities=["上海"], responsibilities="负责产品需求分析",
        requirements="有产品思维", bonus_points="有互联网实习经验",
        tags=[], publish_time=datetime(2024, 9, 1),
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    return job


@pytest.fixture
async def auth_headers(db_session):
    user = User(username="optuser", email="opt@example.com",
                hashed_password=hash_password("pass"))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_token(user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_optimize_success(client, seeded_job, auth_headers):
    with patch("routers.ai.optimize_resume", new_callable=AsyncMock) as mock_opt:
        mock_opt.return_value = (
            "# 优化后的简历\n\n## 教育背景\n...",
            ["突出了产品思维", "使用STAR法则", "添加了量化指标"],
        )
        r = await client.post(
            "/ai/optimize",
            json={"resume_text": "我是一名在校学生，有产品实习经验", "job_id": seeded_job.id},
            headers=auth_headers,
        )
    assert r.status_code == 200
    d = r.json()
    assert "optimized_resume" in d
    assert isinstance(d["suggestions"], list)
    assert len(d["suggestions"]) == 3


@pytest.mark.asyncio
async def test_optimize_both_providers_fail_503(client, seeded_job, auth_headers):
    with patch("routers.ai.optimize_resume", new_callable=AsyncMock) as mock_opt:
        from fastapi import HTTPException
        mock_opt.side_effect = HTTPException(status_code=503, detail="AI service unavailable")
        r = await client.post(
            "/ai/optimize",
            json={"resume_text": "简历内容", "job_id": seeded_job.id},
            headers=auth_headers,
        )
    assert r.status_code == 503
    assert r.json()["detail"] == "AI service unavailable"


@pytest.mark.asyncio
async def test_optimize_job_not_found(client, auth_headers):
    with patch("routers.ai.optimize_resume", new_callable=AsyncMock):
        r = await client.post(
            "/ai/optimize",
            json={"resume_text": "简历内容", "job_id": 99999},
            headers=auth_headers,
        )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_optimize_resume_too_long(client, seeded_job, auth_headers):
    r = await client.post(
        "/ai/optimize",
        json={"resume_text": "x" * 5001, "job_id": seeded_job.id},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "RESUME_TOO_LONG"


@pytest.mark.asyncio
async def test_optimize_requires_auth(client, seeded_job):
    r = await client.post(
        "/ai/optimize",
        json={"resume_text": "简历", "job_id": seeded_job.id},
    )
    assert r.status_code == 403
```

- [ ] Run tests:

```bash
cd D:/ayohi/YesJob/backend
pytest tests/test_ai_optimize.py -v
```

Expected output:
```
tests/test_ai_optimize.py::test_optimize_success PASSED
tests/test_ai_optimize.py::test_optimize_both_providers_fail_503 PASSED
tests/test_ai_optimize.py::test_optimize_job_not_found PASSED
tests/test_ai_optimize.py::test_optimize_resume_too_long PASSED
tests/test_ai_optimize.py::test_optimize_requires_auth PASSED
5 passed in ...
```

- [ ] Run full test suite to confirm no regressions:

```bash
cd D:/ayohi/YesJob/backend
pytest -v
```

Expected output: 36 passed in ...

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add backend/services/llm_service.py backend/routers/ai.py backend/tests/test_ai_optimize.py
git commit -m "task 7: AI optimize endpoint — DeepSeek/Qwen with fallback, suggestions extraction, tests"
```

---

## Task 8: Frontend JS Utilities

**Files:**
- Create `D:/ayohi/YesJob/js/api.js`
- Create `D:/ayohi/YesJob/js/resume.js`

- [ ] Create `D:/ayohi/YesJob/js/api.js`:

```javascript
const API_BASE = 'http://localhost:8000';

function getToken() {
  return localStorage.getItem('access_token');
}

function setToken(token) {
  localStorage.setItem('access_token', token);
}

function clearToken() {
  localStorage.removeItem('access_token');
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = '/pages/home.html?redirect=' + encodeURIComponent(window.location.pathname);
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

async function register(username, email, password) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}

async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data;
}

function logout() {
  clearToken();
  window.location.href = '/pages/home.html';
}

async function getJobs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/jobs?${query}`);
}

async function getJobDetail(jobId) {
  return apiFetch(`/jobs/${jobId}`);
}

async function getFilters() {
  return apiFetch('/jobs/meta/filters');
}

async function matchJobs(resumeText, jobIds) {
  return apiFetch('/ai/match', {
    method: 'POST',
    body: JSON.stringify({ resume_text: resumeText, job_ids: jobIds }),
  });
}

async function optimizeResume(resumeText, jobId) {
  return apiFetch('/ai/optimize', {
    method: 'POST',
    body: JSON.stringify({ resume_text: resumeText, job_id: jobId }),
  });
}

export {
  getToken,
  setToken,
  clearToken,
  apiFetch,
  register,
  login,
  logout,
  getJobs,
  getJobDetail,
  getFilters,
  matchJobs,
  optimizeResume,
};
```

- [ ] Create `D:/ayohi/YesJob/js/resume.js`:

```javascript
const RESUME_STORAGE_KEY = 'yesjob_resume_modules';

function getResumeModules() {
  const data = localStorage.getItem(RESUME_STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveResumeModules(modules) {
  localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(modules));
}

function addResumeModule(module) {
  const modules = getResumeModules();
  module.id = Date.now().toString();
  module.createdAt = new Date().toISOString();
  modules.push(module);
  saveResumeModules(modules);
  return module;
}

function updateResumeModule(id, updates) {
  const modules = getResumeModules();
  const index = modules.findIndex(m => m.id === id);
  if (index === -1) return null;
  modules[index] = { ...modules[index], ...updates, updatedAt: new Date().toISOString() };
  saveResumeModules(modules);
  return modules[index];
}

function deleteResumeModule(id) {
  const modules = getResumeModules();
  const filtered = modules.filter(m => m.id !== id);
  saveResumeModules(filtered);
  return filtered.length < modules.length;
}

function getResumeModule(id) {
  const modules = getResumeModules();
  return modules.find(m => m.id === id) || null;
}

function assembleResumeText(moduleIds = null) {
  const modules = getResumeModules();
  const selected = moduleIds 
    ? modules.filter(m => moduleIds.includes(m.id))
    : modules;
  return selected.map(m => m.content || '').join('\n\n');
}

export {
  getResumeModules,
  saveResumeModules,
  addResumeModule,
  updateResumeModule,
  deleteResumeModule,
  getResumeModule,
  assembleResumeText,
};
```

- [ ] Test manually in browser console:

```javascript
// In browser console on any YesJob page:
import { addResumeModule, getResumeModules, assembleResumeText } from '/js/resume.js';
addResumeModule({ type: 'education', content: '清华大学 计算机科学 2020-2024' });
addResumeModule({ type: 'experience', content: '字节跳动实习生 2023.6-2023.9' });
console.log(getResumeModules());
console.log(assembleResumeText());
```

Expected: Two modules stored, assembled text contains both entries.

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add js/api.js js/resume.js
git commit -m "task 8: frontend JS utilities — API client with auth + 401 redirect, resume localStorage CRUD"
```

---

## Task 9: Wire Job Feed Page

**Files:**
- Modify `D:/ayohi/YesJob/pages/job-feed.html`

- [ ] Read existing `D:/ayohi/YesJob/pages/job-feed.html` to understand structure.

- [ ] Modify `D:/ayohi/YesJob/pages/job-feed.html` — replace mock data with real API calls:

Find the `<script>` section at the bottom of the file. Replace the entire script block with:

```javascript
import { getJobs, getFilters, getToken, matchJobs } from '../js/api.js';
import { assembleResumeText } from '../js/resume.js';

let currentFilters = { page: 1, page_size: 20, sort: 'latest' };
let matchScores = {};

async function loadFilters() {
  try {
    const filters = await getFilters();
    populateFilterDropdown('cityFilter', filters.cities);
    populateFilterDropdown('typeFilter', filters.recruit_types);
    populateFilterDropdown('categoryFilter', filters.job_categories);
  } catch (error) {
    console.error('Failed to load filters:', error);
  }
}

function populateFilterDropdown(selectId, options) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">全部</option>';
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
}

async function loadJobs() {
  try {
    const data = await getJobs(currentFilters);
    renderJobs(data.items);
    renderPagination(data.total, data.page, data.page_size);
    
    if (getToken()) {
      await loadMatchScores(data.items.map(j => j.id));
    }
  } catch (error) {
    console.error('Failed to load jobs:', error);
    document.getElementById('jobList').innerHTML = 
      '<div class="col-span-full text-center text-red-600">加载职位失败，请稍后重试</div>';
  }
}

async function loadMatchScores(jobIds) {
  const resumeText = assembleResumeText();
  if (!resumeText || jobIds.length === 0) return;
  
  try {
    const result = await matchJobs(resumeText, jobIds.slice(0, 50));
    matchScores = result.scores;
    updateMatchBadges();
  } catch (error) {
    console.error('Failed to load match scores:', error);
  }
}

function updateMatchBadges() {
  Object.entries(matchScores).forEach(([jobId, score]) => {
    const card = document.querySelector(`[data-job-id="${jobId}"]`);
    if (!card || score === null) return;
    
    const badge = document.createElement('div');
    badge.className = 'absolute top-2 right-2 bg-primary text-white px-2 py-1 rounded text-sm font-bold';
    badge.textContent = `匹配度 ${score}%`;
    card.style.position = 'relative';
    card.appendChild(badge);
  });
}

function renderJobs(jobs) {
  const container = document.getElementById('jobList');
  if (!container) return;
  
  if (jobs.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center text-gray-500">暂无职位</div>';
    return;
  }
  
  container.innerHTML = jobs.map(job => `
    <div class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition" data-job-id="${job.id}">
      <h3 class="text-xl font-bold text-gray-900 mb-2">${escapeHtml(job.title || '未知职位')}</h3>
      <div class="text-gray-600 mb-4">
        <span class="mr-4">${escapeHtml(job.company || '未知公司')}</span>
        <span class="mr-4">${escapeHtml(job.work_city || '')}</span>
        <span class="text-sm text-gray-500">${escapeHtml(job.recruit_type || '')}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-500">${job.publish_time ? new Date(job.publish_time).toLocaleDateString('zh-CN') : ''}</span>
        <a href="/pages/job-detail.html?id=${job.id}" 
           class="text-primary hover:text-primary-dark font-medium">
          查看详情 →
        </a>
      </div>
    </div>
  `).join('');
}

function renderPagination(total, page, pageSize) {
  const container = document.getElementById('pagination');
  if (!container) return;
  
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '<div class="flex justify-center gap-2">';
  
  if (page > 1) {
    html += `<button onclick="goToPage(${page - 1})" class="px-4 py-2 bg-white border rounded hover:bg-gray-50">上一页</button>`;
  }
  
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    const active = i === page ? 'bg-primary text-white' : 'bg-white hover:bg-gray-50';
    html += `<button onclick="goToPage(${i})" class="px-4 py-2 border rounded ${active}">${i}</button>`;
  }
  
  if (page < totalPages) {
    html += `<button onclick="goToPage(${page + 1})" class="px-4 py-2 bg-white border rounded hover:bg-gray-50">下一页</button>`;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.goToPage = function(page) {
  currentFilters.page = page;
  loadJobs();
};

window.applyFilters = function() {
  const q = document.getElementById('searchInput')?.value || '';
  const city = document.getElementById('cityFilter')?.value || '';
  const recruit_type = document.getElementById('typeFilter')?.value || '';
  const job_category = document.getElementById('categoryFilter')?.value || '';
  
  currentFilters = { page: 1, page_size: 20, sort: 'latest' };
  if (q) currentFilters.q = q;
  if (city) currentFilters.city = city;
  if (recruit_type) currentFilters.recruit_type = recruit_type;
  if (job_category) currentFilters.job_category = job_category;
  
  loadJobs();
};

document.addEventListener('DOMContentLoaded', () => {
  loadFilters();
  loadJobs();
  
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', applyFilters);
  }
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') applyFilters();
    });
  }
});
```

- [ ] Test in browser:

1. Start backend: `cd D:/ayohi/YesJob/backend && uvicorn main:app --reload`
2. Open `D:/ayohi/YesJob/pages/job-feed.html` in browser
3. Verify: Job cards load from API, filters populate, pagination works
4. Login with a test account, add resume modules, refresh job-feed
5. Verify: Match score badges appear on job cards

Expected: Real job data from PostgreSQL, working filters, match badges for logged-in users with resumes.

- [ ] Git commit:

```bash
cd D:/ayohi/YesJob
git add pages/job-feed.html
git commit -m "task 9: wire job-feed page — fetch real jobs from API, show match badges for logged-in users"
```

---

## Implementation Complete

All 9 tasks completed. The YesJob backend is now fully functional with:

- FastAPI app with health check, lifespan management, and auto-import of jobs
- PostgreSQL ORM models for users and jobs (SQLite for tests)
- Job import script (idempotent, batch inserts, date parsing)
- Jobs API (list with filters/search/pagination, detail, filters metadata)
- Auth API (register, login with JWT, bcrypt password hashing)
- AI match endpoint (Ollama local inference, batch scoring, null fallback)
- AI optimize endpoint (DeepSeek → Qwen fallback, suggestions extraction)
- Frontend JS utilities (API client with auth, resume localStorage CRUD)
- Wired job-feed page (real API data, match badges)

**Next steps:**
- Run `cd D:/ayohi/YesJob/backend && pytest` to verify all 36 tests pass
- Start backend: `uvicorn main:app --reload`
- Test frontend pages in browser
- Deploy to production (configure .env with real database and API keys)

