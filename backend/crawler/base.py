"""采集适配器基类

统一约定：
- 每个适配器实现 fetch_jobs() -> list[dict]，返回的 dict 字段与
  backend/scripts/import_jobs.py 的 record_to_dict 输入对齐：
  job_id/company/title/recruit_type/job_category/job_function/work_city/
  work_cities/team_intro/responsibilities/requirements/bonus_points/
  tags/publish_time/fetched_at/detail_url/source_page
- normalize_record() 复用 services.search_utils 的城市/类别归一化，
  保证落库前数据与搜索侧处理一致（避免重复造轮子）
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any

import httpx

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


class BaseAdapter(ABC):
    """招聘源适配器基类。子类只需实现 fetch_jobs 与 _raw_to_record。"""

    #: companies.json 中的企业 id（用于路由）
    company_ids: list[str] = []
    #: 企业中文名（单企业适配器直接设；多企业平台适配器在配置中指定）
    company_name: str | None = None

    def __init__(self, company: dict[str, Any], client: httpx.AsyncClient | None = None):
        self.company = company
        self.company_name = company.get("name") or self.company_name
        self.client = client

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {"User-Agent": DEFAULT_UA, "Accept": "application/json, text/plain, */*"}
        if extra:
            h.update(extra)
        return h

    async def _post_json(self, url: str, body: dict, headers: dict | None = None) -> Any:
        """POST JSON，自动重试一次（网络抖动兜底）。"""
        assert self.client is not None
        for attempt in (0, 1):
            try:
                resp = await self.client.post(
                    url, json=body, headers=self._headers(headers), timeout=20
                )
                resp.raise_for_status()
                return resp.json()
            except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.TransportError):
                if attempt == 1:
                    raise
                time.sleep(1.5)

    async def _get_json(self, url: str, headers: dict | None = None) -> Any:
        assert self.client is not None
        resp = await self.client.get(url, headers=self._headers(headers), timeout=20)
        resp.raise_for_status()
        return resp.json()

    @abstractmethod
    async def fetch_jobs(self) -> list[dict[str, Any]]:
        """拉取全量岗位，返回归一化后的记录列表。"""

    @staticmethod
    def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
        """归一化：城市/类别走 search_utils，保证与搜索侧一致。"""
        from services.search_utils import normalize_city_values, normalize_job_category

        cities = normalize_city_values(
            record.get("work_city"), record.get("work_cities") or []
        )
        return {
            "job_id": str(record.get("job_id", "")),
            "company": record.get("company"),
            "title": record.get("title"),
            "recruit_type": record.get("recruit_type"),
            "job_category": normalize_job_category(record.get("job_category")),
            "job_function": record.get("job_function"),
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": record.get("team_intro") or "",
            "responsibilities": record.get("responsibilities") or "",
            "requirements": record.get("requirements") or "",
            "bonus_points": record.get("bonus_points") or "",
            "tags": record.get("tags") or [],
            "publish_time": record.get("publish_time"),
            "fetched_at": record.get("fetched_at") or time.strftime("%Y-%m-%d %H:%M:%S"),
            "detail_url": record.get("detail_url"),
            "source_page": record.get("source_page"),
        }
