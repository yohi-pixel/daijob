import json
import pytest
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
