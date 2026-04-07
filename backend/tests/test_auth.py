import pytest


@pytest.mark.asyncio
async def test_register_success(client):
    r = await client.post("/auth/register", json={
        "username": "alice", "email": "alice@example.com", "password": "secret123"
    })
    assert r.status_code == 200
    d = r.json()
    assert "user_id" in d
    assert d["message"] == "Registration successful"


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    await client.post("/auth/register", json={
        "username": "bob", "email": "bob@example.com", "password": "pass1"
    })
    r = await client.post("/auth/register", json={
        "username": "bob2", "email": "bob@example.com", "password": "pass2"
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post("/auth/register", json={
        "username": "charlie", "email": "charlie@example.com", "password": "mypassword"
    })
    r = await client.post("/auth/login", json={
        "email": "charlie@example.com", "password": "mypassword"
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
