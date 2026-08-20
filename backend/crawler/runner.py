"""采集调度入口

用法：
  cd backend
  python -m crawler.runner --companies popmart,transsion
  python -m crawler.runner --source api          # 跑所有 api 直连类
  python -m crawler.runner --all                 # 全部（含未知/需浏览器的会跳过并提示）
  python -m crawler.runner --out ../data/jobs.jsonl --append

输出：JSONL，字段与 import_jobs.py 对齐（见 base.normalize_record）。
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

import httpx

from .base import DEFAULT_UA
from .zhiye import ZhiyeAdapter
from .mokahr import MokahrAdapter
from .tencent import TencentAdapter
from .jd import JDAdapter
from .html_adapters import SmicAdapter, LizhiAdapter
from .feishu import FeishuHireAdapter
from .shein import SheinAdapter
from .netease import NeteaseAdapter
from .mt_pdd_ali import MeituanAdapter, PddAdapter, AlibabaAdapter

# platform -> 适配器
API_ADAPTERS = {
    "zhiye": ZhiyeAdapter,
    "mokahr": MokahrAdapter,
    "tencent": TencentAdapter,
    "jd": JDAdapter,
    "smic": SmicAdapter,
    "lizhi": LizhiAdapter,
    "feishu": FeishuHireAdapter,
    "shein": SheinAdapter,
    "netease": NeteaseAdapter,
    "meituan": MeituanAdapter,
    "pdd": PddAdapter,
    "alibaba": AlibabaAdapter,
}

ROOT = Path(__file__).resolve().parents[2]
COMPANIES_FILE = ROOT / "data" / "companies.json"


def load_companies() -> list[dict]:
    return json.loads(COMPANIES_FILE.read_text(encoding="utf-8"))["companies"]


def resolve_adapters(companies: list[dict], ids: list[str] | None, source: str | None):
    """按 companies.json 的 platform + data_source 匹配适配器。"""
    selected: list[tuple[dict, type]] = []
    for c in companies:
        if ids and c["id"] not in ids:
            continue
        platform = c.get("platform", "")
        adapter_cls = API_ADAPTERS.get(platform)
        if adapter_cls is None:
            continue
        if source and c.get("data_source") != source:
            continue
        selected.append((c, adapter_cls))
    return selected


async def run_one(company: dict, adapter_cls: type) -> list[dict]:
    async with httpx.AsyncClient(
        headers={"User-Agent": DEFAULT_UA},
        timeout=20,
        limits=httpx.Limits(max_connections=4),
    ) as client:
        adapter = adapter_cls(company, client=client)
        records = await adapter.fetch_jobs()
        for r in records:
            r["company"] = company["name"]
        return records


def write_jsonl(records: list[dict], out: Path, append: bool) -> None:
    mode = "a" if append else "w"
    with out.open(mode, encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


async def main() -> None:
    p = argparse.ArgumentParser(description="逮JOB 岗位采集器")
    p.add_argument("--companies", default="", help="逗号分隔企业 id，空=全部")
    p.add_argument("--source", default="", choices=["api", "html", "browser", ""], help="按数据来源过滤")
    p.add_argument("--out", default=str(ROOT / "data" / "jobs.jsonl"), help="输出 JSONL 路径")
    p.add_argument("--append", action="store_true", help="追加模式（默认覆盖）")
    args = p.parse_args()

    companies = load_companies()
    ids = [x.strip() for x in args.companies.split(",") if x.strip()] or None
    selected = resolve_adapters(companies, ids, args.source or None)

    if not selected:
        print("没有匹配的适配器。已支持:", ", ".join(sorted(API_ADAPTERS)))
        print("可用企业:", ", ".join(c["id"] for c in companies if c.get("platform") in API_ADAPTERS))
        sys.exit(1)

    print(f"待采集 {len(selected)} 家: {', '.join(c['name'] for c, _ in selected)}")
    all_records: list[dict] = []
    for company, adapter_cls in selected:
        try:
            records = await run_one(company, adapter_cls)
            print(f"  ✓ {company['name']}: {len(records)} 条")
            all_records.extend(records)
        except Exception as e:
            print(f"  ✗ {company['name']}: {e}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    write_jsonl(all_records, out, args.append)
    print(f"\n共 {len(all_records)} 条 → {out} ({out.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    asyncio.run(main())
