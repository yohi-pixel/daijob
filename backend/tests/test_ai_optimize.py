import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_optimize_requires_auth(client):
    r = await client.post("/ai/optimize", json={"resume_text": "test", "job_id": 1})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_optimize_resume_too_long(client, db_session):
    from models.user import User
    from services.auth_service import create_access_token
    user = User(username="opt1", email="opt1@example.com", hashed_password="hashed")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token, _ = create_access_token(user.id)
    r = await client.post(
        "/ai/optimize",
        json={"resume_text": "x" * 5001, "job_id": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400
    assert "RESUME_TOO_LONG" in r.json()["detail"]


@pytest.mark.asyncio
async def test_optimize_job_not_found(client, db_session):
    from models.user import User
    from services.auth_service import create_access_token
    user = User(username="opt2", email="opt2@example.com", hashed_password="hashed")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token, _ = create_access_token(user.id)
    r = await client.post(
        "/ai/optimize",
        json={"resume_text": "test resume", "job_id": 99999},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_optimize_success(client, db_session):
    from models.user import User
    from models.job import Job
    from services.auth_service import create_access_token
    user = User(username="opt3", email="opt3@example.com", hashed_password="hashed")
    db_session.add(user)
    job = Job(
        job_id="OPT1",
        title="Python Developer",
        company="TestCo",
        responsibilities="Build APIs",
        requirements="Python, FastAPI",
        bonus_points="Docker experience",
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(job)
    token, _ = create_access_token(user.id)
    with patch("routers.ai.optimize_resume", new_callable=AsyncMock) as mock_opt:
        mock_opt.return_value = ("# Optimized Resume\n\nContent here", ["Added STAR format", "Highlighted Python skills"])
        r = await client.post(
            "/ai/optimize",
            json={"resume_text": "My resume", "job_id": job.id},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200
    d = r.json()
    assert "optimized_resume" in d
    assert "suggestions" in d
    assert len(d["suggestions"]) == 2


@pytest.mark.asyncio
async def test_optimize_both_providers_fail(client, db_session):
    from models.user import User
    from models.job import Job
    from services.auth_service import create_access_token
    user = User(username="opt4", email="opt4@example.com", hashed_password="hashed")
    db_session.add(user)
    job = Job(job_id="OPT2", title="Test Job", company="TestCo")
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(job)
    token, _ = create_access_token(user.id)
    with patch("routers.ai.optimize_resume", new_callable=AsyncMock) as mock_opt:
        from fastapi import HTTPException
        mock_opt.side_effect = HTTPException(status_code=503, detail="AI service unavailable")
        r = await client.post(
            "/ai/optimize",
            json={"resume_text": "My resume", "job_id": job.id},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 503
