import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_match_requires_auth(client):
    r = await client.post("/ai/match", json={"resume_text": "test", "job_ids": [1]})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_match_too_many_jobs(client, db_session):
    from models.user import User
    from services.auth_service import create_access_token
    user = User(username="test", email="test@example.com", hashed_password="hashed")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token, _ = create_access_token(user.id)
    r = await client.post(
        "/ai/match",
        json={"resume_text": "test", "job_ids": list(range(51))},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400
    assert "TOO_MANY_JOBS" in r.json()["detail"]


@pytest.mark.asyncio
async def test_match_resume_too_long(client, db_session):
    from models.user import User
    from services.auth_service import create_access_token
    user = User(username="test2", email="test2@example.com", hashed_password="hashed")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token, _ = create_access_token(user.id)
    r = await client.post(
        "/ai/match",
        json={"resume_text": "x" * 5001, "job_ids": [1]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400
    assert "RESUME_TOO_LONG" in r.json()["detail"]


@pytest.mark.asyncio
async def test_match_success(client, db_session):
    from models.user import User
    from models.job import Job
    from services.auth_service import create_access_token
    user = User(username="test3", email="test3@example.com", hashed_password="hashed")
    db_session.add(user)
    job1 = Job(job_id="M1", title="Python Dev", company="TestCo")
    job2 = Job(job_id="M2", title="Go Dev", company="TestCo")
    db_session.add(job1)
    db_session.add(job2)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(job1)
    await db_session.refresh(job2)
    token, _ = create_access_token(user.id)
    with patch("routers.ai.batch_match", new_callable=AsyncMock) as mock_batch:
        mock_batch.return_value = {job1.id: 85, job2.id: 72}
        r = await client.post(
            "/ai/match",
            json={"resume_text": "I am a Python developer", "job_ids": [job1.id, job2.id]},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200
    d = r.json()
    assert "scores" in d
    assert str(job1.id) in d["scores"]
    assert d["scores"][str(job1.id)] == 85


@pytest.mark.asyncio
async def test_match_ollama_failure_returns_null(client, db_session):
    from models.user import User
    from models.job import Job
    from services.auth_service import create_access_token
    user = User(username="test4", email="test4@example.com", hashed_password="hashed")
    db_session.add(user)
    job = Job(job_id="M3", title="Test Job", company="TestCo")
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(job)
    token, _ = create_access_token(user.id)
    with patch("routers.ai.batch_match", new_callable=AsyncMock) as mock_batch:
        mock_batch.return_value = {job.id: None}
        r = await client.post(
            "/ai/match",
            json={"resume_text": "test", "job_ids": [job.id]},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200
    d = r.json()
    assert d["scores"][str(job.id)] is None


@pytest.mark.asyncio
async def test_match_empty_job_list(client, db_session):
    from models.user import User
    from services.auth_service import create_access_token
    user = User(username="test5", email="test5@example.com", hashed_password="hashed")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token, _ = create_access_token(user.id)
    r = await client.post(
        "/ai/match",
        json={"resume_text": "test", "job_ids": []},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["scores"] == {}
