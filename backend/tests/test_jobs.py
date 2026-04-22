import pytest
from datetime import datetime
from models.job import Job


@pytest.fixture
async def seed_jobs(db_session):
    jobs = [
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
        Job(job_id="J004", company="海外公司", title="AI Platform Engineer",
            recruit_type="社招", job_category="研发类", work_city="东京/新加坡",
            work_cities=["东京", "新加坡"], responsibilities="构建检索增强系统",
            requirements="有RAG系统落地经验", bonus_points="懂BM25和向量召回", tags=[],
            publish_time=datetime(2024, 8, 2, 10, 0, 0),
            detail_url="https://example.com/40001"),
    ]
    for j in jobs:
        db_session.add(j)
    await db_session.commit()
    for j in jobs:
        await db_session.refresh(j)
    return jobs


@pytest.mark.asyncio
async def test_list_jobs_default(client, seed_jobs):
    r = await client.get("/jobs")
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 4
    assert len(d["items"]) == 4


@pytest.mark.asyncio
async def test_list_jobs_filter_city(client, seed_jobs):
    r = await client.get("/jobs", params={"city": "北京"})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 1
    assert d["items"][0]["company"] == "字节跳动"


@pytest.mark.asyncio
async def test_list_jobs_filter_recruit_type(client, seed_jobs):
    r = await client.get("/jobs", params={"recruit_type": "校招"})
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["company"] == "腾讯"


@pytest.mark.asyncio
async def test_list_jobs_filter_category(client, seed_jobs):
    r = await client.get("/jobs", params={"job_category": "技术类"})
    assert r.status_code == 200
    assert r.json()["total"] == 2


@pytest.mark.asyncio
async def test_list_jobs_search(client, seed_jobs):
    r = await client.get("/jobs", params={"q": "前端"})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 1
    assert d["items"][0]["title"] == "前端开发工程师"


@pytest.mark.asyncio
async def test_list_jobs_semantic_search_requirements_and_bonus(client, seed_jobs):
    r = await client.get("/jobs", params={"q": "RAG 向量 BM25"})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 1
    assert d["items"][0]["company"] == "海外公司"


@pytest.mark.asyncio
async def test_list_jobs_exclude_company(client, seed_jobs):
    r = await client.get("/jobs", params={"company": "-字节跳动"})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 3
    companies = {item["company"] for item in d["items"]}
    assert "字节跳动" not in companies


@pytest.mark.asyncio
async def test_list_jobs_exclude_city(client, seed_jobs):
    r = await client.get("/jobs", params={"city": "-深圳"})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 3
    companies = {item["company"] for item in d["items"]}
    assert "腾讯" not in companies


@pytest.mark.asyncio
async def test_list_jobs_city_normalization_overseas(client, seed_jobs):
    r = await client.get("/jobs", params={"city": "海外"})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 1
    assert d["items"][0]["company"] == "海外公司"


@pytest.mark.asyncio
async def test_list_jobs_search_no_results(client, seed_jobs):
    r = await client.get("/jobs", params={"q": "不存在XYZ"})
    assert r.status_code == 200
    assert r.json()["total"] == 0


@pytest.mark.asyncio
async def test_list_jobs_pagination(client, seed_jobs):
    r = await client.get("/jobs", params={"page": 1, "page_size": 2})
    assert r.status_code == 200
    d = r.json()
    assert len(d["items"]) == 2
    assert d["total"] == 4


@pytest.mark.asyncio
async def test_list_jobs_sort_latest(client, seed_jobs):
    r = await client.get("/jobs", params={"sort": "latest"})
    assert r.status_code == 200
    assert r.json()["items"][0]["company"] == "海外公司"


@pytest.mark.asyncio
async def test_job_detail(client, seed_jobs):
    from sqlalchemy import select
    job = seed_jobs[0]
    r = await client.get(f"/jobs/{job.id}")
    assert r.status_code == 200
    d = r.json()
    assert d["job_id"] == "J001"
    assert d["work_cities"] == ["上海"]


@pytest.mark.asyncio
async def test_job_detail_not_found(client, seed_jobs):
    r = await client.get("/jobs/99999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_filters_meta(client, seed_jobs):
    r = await client.get("/jobs/meta/filters")
    assert r.status_code == 200
    d = r.json()
    assert set(d["cities"]) == {"上海", "北京", "深圳", "海外"}
    assert set(d["recruit_types"]) == {"实习", "校招", "社招"}
    assert set(d["job_categories"]) == {"产品运营类", "技术类"}
