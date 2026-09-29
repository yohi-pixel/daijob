"""SHEIN 校招适配器（careers.shein.cn 同域接口，实测可直连）

接口：
  POST https://careers.shein.cn/api/v1/open/grw/front/jobPage
  body: {"current":1,"jobCategoryIds":[],"cityName":"","countryIds":[],
         "cityIds":[],"jobTypeIds":["CAMPUS"],"key":"","langCode":"CN","size":10}
  响应: {"code":"0","info":{"total","records":[{jobId,jobTitle,jobCategoryName,
         countryId,source,jobTypeId,releaseDate,description,...}]}}
  校招过滤：jobTypeIds=["CAMPUS"]（当前中国站校招量少，社招 source=moka 量大）
"""
from __future__ import annotations

from typing import Any

from .base import BaseAdapter


class SheinAdapter(BaseAdapter):
    company_ids = ["shein"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        url = "https://careers.shein.cn/api/v1/open/grw/front/jobPage"
        records: list[dict[str, Any]] = []
        current = 1
        size = 50
        headers = {
            "Referer": "https://careers.shein.cn/",
            "Origin": "https://careers.shein.cn",
        }
        while True:
            body = {
                "current": current,
                "jobCategoryIds": [],
                "cityName": "",
                "countryIds": [],
                "cityIds": [],
                "jobTypeIds": ["CAMPUS"],
                "key": "",
                "langCode": "CN",
                "size": size,
            }
            data = await self._post_json(url, body, headers=headers)
            info = (data or {}).get("info") or {}
            items = info.get("records") or []
            for it in items:
                records.append(self._raw_to_record(it))
            total = info.get("total") or 0
            if not items or current * size >= total:
                break
            current += 1
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        import re as _re

        desc = _re.sub(r"<[^>]+>", "", str(it.get("description") or "")).strip()
        # 城市在 cityInfos 数组（[{"cityId","cityName","jobNum"}]），非顶层 cityName
        cities: list[str] = []
        for c in it.get("cityInfos") or []:
            if isinstance(c, dict):
                name = c.get("cityName") or c.get("name")
                if name and name not in cities:
                    cities.append(str(name))
        return {
            "job_id": it.get("jobId") or it.get("id"),
            "company": self.company_name,
            "title": it.get("jobTitle"),
            "recruit_type": "校招" if "CAMPUS" in (it.get("jobTypeId") or "") else None,
            "job_category": it.get("jobCategoryName"),
            "job_function": None,
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": "",
            "responsibilities": desc,
            "requirements": "",
            "bonus_points": "",
            "tags": [],
            "publish_time": it.get("releaseDate"),
            "fetched_at": None,
            "detail_url": it.get("jobDetailUrl") or it.get("jobUrl"),
            "source_page": self.company["name"],
        }
