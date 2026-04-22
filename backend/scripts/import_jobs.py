import asyncio
import json
from datetime import datetime
from pathlib import Path
from sqlalchemy import select, func, text
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from database import Base
from models.job import Job
from config import settings
from services.search_utils import normalize_city_values, normalize_job_category


def parse_publish_time(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return None


def parse_fetched_at(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


def record_to_dict(record: dict) -> dict:
    normalized_cities = normalize_city_values(record.get("work_city"), record.get("work_cities") or [])
    return {
        "job_id": str(record.get("job_id", "")),
        "company": record.get("company"),
        "title": record.get("title"),
        "recruit_type": record.get("recruit_type"),
        "job_category": normalize_job_category(record.get("job_category")),
        "job_function": record.get("job_function"),
        "work_city": normalized_cities[0] if normalized_cities else None,
        "work_cities": normalized_cities,
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
                    await session.execute(mysql_insert(Job).prefix_with("IGNORE"), batch)
                    await session.commit()
                    total += len(batch)
                    batch = []

        if batch:
            await session.execute(mysql_insert(Job).prefix_with("IGNORE"), batch)
            await session.commit()
            total += len(batch)

        print(f"[import_jobs] Imported {total} jobs.")
    finally:
        if own_session:
            await session.close()
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_import(settings.JOBS_FILE))
