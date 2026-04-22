import asyncio
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from config import settings
from database import Base
from models.job import Job
from services.search_utils import normalize_city_values, normalize_job_category


async def run_clean_history_jobs(
    session: AsyncSession | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """Clean existing jobs in DB by normalizing city and category fields."""
    own_session = session is None
    if own_session:
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        session = SessionLocal()

    total = 0
    updated = 0
    city_updated = 0
    category_updated = 0

    try:
        result = await session.execute(select(Job))
        jobs = result.scalars().all()

        for job in jobs:
            total += 1
            changed = False

            normalized_cities = normalize_city_values(job.work_city, job.work_cities or [])
            new_city = normalized_cities[0] if normalized_cities else None
            if job.work_city != new_city or (job.work_cities or []) != normalized_cities:
                job.work_city = new_city
                job.work_cities = normalized_cities
                city_updated += 1
                changed = True

            new_category = normalize_job_category(job.job_category)
            if job.job_category != new_category:
                job.job_category = new_category
                category_updated += 1
                changed = True

            if changed:
                updated += 1

        if dry_run:
            await session.rollback()
        else:
            await session.commit()

        return {
            "total": total,
            "updated": updated,
            "city_updated": city_updated,
            "category_updated": category_updated,
        }
    finally:
        if own_session:
            await session.close()
            await engine.dispose()


async def _main():
    dry_run = "--dry-run" in __import__("sys").argv
    summary = await run_clean_history_jobs(dry_run=dry_run)
    mode = "DRY-RUN" if dry_run else "APPLY"
    print(
        f"[clean_jobs][{mode}] total={summary['total']} updated={summary['updated']} "
        f"city_updated={summary['city_updated']} category_updated={summary['category_updated']}"
    )


if __name__ == "__main__":
    asyncio.run(_main())
