import json

from scripts.clean_jobs_file import clean_jsonl_file, clean_record


def test_clean_record_normalizes_city_and_category():
    record = {
        "job_id": "X001",
        "work_city": "东京/新加坡",
        "work_cities": [],
        "job_category": "后端开发",
    }

    cleaned, stats = clean_record(record)

    assert cleaned["work_city"] == "海外"
    assert cleaned["work_cities"] == ["海外"]
    assert cleaned["job_category"] == "技术类"
    assert stats["city_changed"] is True
    assert stats["category_changed"] is True


def test_clean_jsonl_file_normalizes_and_deduplicates(tmp_path):
    input_path = tmp_path / "jobs.jsonl"
    output_path = tmp_path / "jobs.cleaned.jsonl"

    records = [
        {
            "job_id": "DUP-1",
            "title": "旧标题",
            "company": "A",
            "work_city": "北京市",
            "work_cities": "北京/上海",
            "job_category": "产品",
            "publish_time": "2024-01-01 00:00:00",
        },
        {
            "job_id": "DUP-1",
            "title": "新标题",
            "company": "A",
            "work_city": "北京",
            "work_cities": ["北京"],
            "job_category": "产品运营",
            "publish_time": "2024-02-01 00:00:00",
        },
        {
            "job_id": "X002",
            "title": "海外岗位",
            "company": "B",
            "work_city": "Tokyo",
            "work_cities": [],
            "job_category": "算法",
            "publish_time": "2024-01-15 00:00:00",
        },
    ]

    with input_path.open("w", encoding="utf-8") as f:
        for item in records:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    summary = clean_jsonl_file(input_path, output_path=output_path, deduplicate=True)

    assert summary["total_in"] == 3
    assert summary["total_out"] == 2
    assert summary["deduplicated"] == 1
    assert summary["city_changed"] >= 1
    assert summary["category_changed"] >= 1

    lines = output_path.read_text(encoding="utf-8").splitlines()
    output_records = [json.loads(line) for line in lines if line.strip()]

    dup = [r for r in output_records if r["job_id"] == "DUP-1"]
    assert len(dup) == 1
    assert dup[0]["title"] == "新标题"
    assert dup[0]["work_cities"] == ["北京"]
    assert dup[0]["job_category"] == "产品运营类"

    overseas = [r for r in output_records if r["job_id"] == "X002"][0]
    assert overseas["work_city"] == "海外"
    assert overseas["job_category"] == "技术类"
