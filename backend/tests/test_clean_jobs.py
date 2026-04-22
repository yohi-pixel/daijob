import pytest
from sqlalchemy import select

from models.job import Job
from scripts.clean_jobs import run_clean_history_jobs


@pytest.mark.asyncio
async def test_clean_history_jobs_updates_dirty_data(db_session):
    jobs = [
        Job(
            job_id="C001",
            company="A",
            title="t1",
            work_city="北京市",
            work_cities=["北京/上海"],
            job_category="研发类",
        ),
        Job(
            job_id="C002",
            company="B",
            title="t2",
            work_city="东京/新加坡",
            work_cities=[],
            job_category="技术类",
        ),
    ]
    for j in jobs:
        db_session.add(j)
    await db_session.commit()

    summary = await run_clean_history_jobs(session=db_session, dry_run=False)

    assert summary["total"] == 2
    assert summary["updated"] == 2
    assert summary["city_updated"] == 2
    assert summary["category_updated"] == 1

    result = await db_session.execute(select(Job).where(Job.job_id == "C001"))
    c1 = result.scalar_one()
    assert c1.work_city == "北京"
    assert c1.work_cities == ["北京", "上海"]
    assert c1.job_category == "技术类"

    result = await db_session.execute(select(Job).where(Job.job_id == "C002"))
    c2 = result.scalar_one()
    assert c2.work_city == "海外"
    assert c2.work_cities == ["海外"]


@pytest.mark.asyncio
async def test_clean_history_jobs_dry_run_no_persist(db_session):
    job = Job(
        job_id="C003",
        company="C",
        title="t3",
        work_city="北京市",
        work_cities=["北京市"],
        job_category="研发类",
    )
    db_session.add(job)
    await db_session.commit()

    summary = await run_clean_history_jobs(session=db_session, dry_run=True)
    assert summary["updated"] == 1

    await db_session.rollback()
    result = await db_session.execute(select(Job).where(Job.job_id == "C003"))
    c3 = result.scalar_one()
    assert c3.work_city == "北京市"
    assert c3.work_cities == ["北京市"]
    assert c3.job_category == "研发类"
