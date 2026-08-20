"""美团 / 拼多多 / 阿里 适配器（匿名可直连）

- 美团：POST zhaopin.meituan.com/api/official/job/getJobList
  - 校招入口：jobShareType="1" + jobType=[{code:1}(应届生),{code:2}(转正实习)]，单页上限 50
  - 社招（jobShareType 缺省）jobType=3 海外岗，已废弃不采
- 拼多多：POST careers.pddglobalhr.com/api/careers/api/recruit/position/list（裸请求，22 条）
- 阿里：POST talent.alibaba.com/position/search?_csrf=<XSRF-TOKEN>（需先 GET 拿 cookie；当前非招聘季返回 0）
"""
from __future__ import annotations

import re
from typing import Any

import httpx

from .base import BaseAdapter

_MT_JOB_TYPE = {"1": "校招-应届", "2": "校招-转正实习"}


class MeituanAdapter(BaseAdapter):
    company_ids = ["meituan"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        url = "https://zhaopin.meituan.com/api/official/job/getJobList"
        records: list[dict[str, Any]] = []
        page = 1
        page_size = 50
        headers = {
            "Referer": "https://zhaopin.meituan.com/web/campus",
            "Origin": "https://zhaopin.meituan.com",
        }
        while True:
            # 校招：jobShareType=1 + jobType=[应届生, 转正实习]
            body = {
                "page": {"pageNo": page, "pageSize": page_size},
                "jobShareType": "1",
                "keywords": "",
                "cityList": [],
                "department": [],
                "jfJgList": [],
                "jobType": [{"code": "1", "subCode": []}, {"code": "2", "subCode": []}],
                "typeCode": [],
                "specialCode": [],
            }
            data = await self._post_json(url, body, headers=headers)
            result = (data or {}).get("data") or {}
            items = result.get("list") or []
            for it in items:
                records.append(self._raw_to_record(it))
            if len(items) < page_size:  # 美团无 total 字段，不满页即结束
                break
            page += 1
            if page > 100:  # 安全上限
                break
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        cities: list[str] = []
        cl = it.get("cityList") or []
        for c in cl:
            if isinstance(c, dict):
                name = c.get("name") or c.get("cityName")
                if name and name not in cities:
                    cities.append(str(name))
        return {
            "job_id": it.get("jobUnionId") or it.get("id"),
            "company": self.company_name,
            "title": it.get("name"),
            "recruit_type": _MT_JOB_TYPE.get(str(it.get("jobType")), "校招"),
            "job_category": it.get("jobFamily"),
            "job_function": it.get("jobFamilyGroup"),
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": "",
            "responsibilities": it.get("jobDuty") or "",
            "requirements": it.get("jobRequirement") or "",
            "bonus_points": it.get("highLight") or "",
            "tags": it.get("tag") or [],
            "publish_time": _ts_to_str(it.get("refreshTime") or it.get("firstPostTime")),
            "fetched_at": None,
            "detail_url": it.get("url") or it.get("positionUrl"),
            "source_page": self.company["name"],
        }


class PddAdapter(BaseAdapter):
    company_ids = ["pinduoduo"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        url = "https://careers.pddglobalhr.com/api/careers/api/recruit/position/list"
        records: list[dict[str, Any]] = []
        page = 1
        page_size = 50
        headers = {
            "Referer": "https://careers.pddglobalhr.com/",
            "Origin": "https://careers.pddglobalhr.com",
        }
        while True:
            body = {"page": page, "pageSize": page_size}
            data = await self._post_json(url, body, headers=headers)
            result = (data or {}).get("result") or {}
            items = result.get("list") or []
            for it in items:
                records.append(self._raw_to_record(it))
            total = _safe_int(result.get("total"))
            if not items or (total and page * page_size >= total):
                break
            page += 1
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        return {
            "job_id": it.get("code") or it.get("id"),
            "company": self.company_name,
            "title": it.get("name"),
            "recruit_type": it.get("recruitTypeName") or "校招",
            "job_category": it.get("jobName"),
            "job_function": None,
            "work_city": it.get("workLocationName") or it.get("workLocation"),
            "work_cities": [it.get("workLocationName")] if it.get("workLocationName") else [],
            "team_intro": "",
            "responsibilities": it.get("jobDuty") or "",
            "requirements": "",
            "bonus_points": "",
            "tags": it.get("labelList") or [],
            "publish_time": _ts_to_str(it.get("releaseTime")),
            "fetched_at": None,
            "detail_url": it.get("url"),
            "source_page": self.company["name"],
        }


def _ts_to_str(ts):
    """毫秒时间戳 → ISO 字符串"""
    from datetime import datetime, timezone

    if not ts:
        return None
    try:
        return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def _safe_int(v):
    try:
        return int(v) if v is not None else 0
    except (TypeError, ValueError):
        return 0


class AlibabaAdapter(BaseAdapter):
    company_ids = ["alibaba"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        # 先 GET 页面拿 cookie（XSRF-TOKEN），再 POST /position/search?_csrf=token
        assert self.client is not None
        portal = "https://talent.alibaba.com/"
        resp = await self.client.get(portal, headers=self._headers(), follow_redirects=True)
        xsrf = ""
        for c in self.client.cookies.jar:
            if c.name.lower() in ("xsrf-token", "_xsrf", "csrf"):
                xsrf = c.value
                break
        # 兜底：从 HTML 找 token
        if not xsrf:
            m = re.search(r"__token__[^A-Za-z0-9]*([A-Za-z0-9_\-]+)", resp.text)
            if m:
                xsrf = m.group(1)

        records: list[dict[str, Any]] = []
        page = 1
        page_size = 50
        url = f"https://talent.alibaba.com/position/search?_csrf={xsrf}"
        headers = {
            "Referer": portal,
            "Origin": "https://talent.alibaba.com",
            "Cookie": "; ".join(f"{c.name}={c.value}" for c in self.client.cookies.jar),
        }
        while True:
            body = {
                "channel": "campus_group_official_site",
                "language": "zh",
                "pageSize": page_size,
                "page": page,
            }
            data = await self._post_json(url, body, headers=headers)
            items = ((data or {}).get("data") or {}).get("content") or []
            for it in items:
                records.append(self._raw_to_record(it))
            total = ((data or {}).get("data") or {}).get("totalElements") or 0
            if not items or page * page_size >= total:
                break
            page += 1
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        return {
            "job_id": it.get("id") or it.get("postId"),
            "company": self.company_name,
            "title": it.get("positionName") or it.get("title"),
            "recruit_type": "校招",
            "job_category": it.get("positionFamily") or it.get("category"),
            "job_function": None,
            "work_city": it.get("workCity") or it.get("city"),
            "work_cities": [it.get("workCity")] if it.get("workCity") else [],
            "team_intro": "",
            "responsibilities": it.get("responsibility") or it.get("description") or "",
            "requirements": it.get("requirement") or "",
            "bonus_points": "",
            "tags": [],
            "publish_time": None,
            "fetched_at": None,
            "detail_url": it.get("url"),
            "source_page": self.company["name"],
        }
