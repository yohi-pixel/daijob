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
