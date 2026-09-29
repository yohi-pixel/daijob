"""京东校招适配器（campus.jd.com，实测可用）

接口：
  POST https://campus.jd.com/api/wx/position/page?type=present
  body: {"pageSize":10,"pageIndex":1,"parameter":{"positionName":"","planIdList":[],
        "jobDirectionCodeList":[],"workCityCodeList":[],"positionDeptList":[]}}
  需 X-Requested-With: XMLHttpRequest + Origin/Referer
  响应: {success:true, body:{totalNumber:98, items:[{publishId, positionName,
        jobDirection, workContent, qualification, education, planName,...}]}}
"""
from __future__ import annotations

from typing import Any

from .base import BaseAdapter


class JDAdapter(BaseAdapter):
    company_ids = ["jd"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        url = "https://campus.jd.com/api/wx/position/page?type=present"
        records: list[dict[str, Any]] = []
        page = 1
        page_size = 20  # 实测京东接口单页上限约 20（pageSize=100 也只返回 21）
        headers = {
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://campus.jd.com/",
            "Origin": "https://campus.jd.com",
        }
        while True:
            body = {
                "pageSize": page_size,
                "pageIndex": page,
                "parameter": {
                    "positionName": "",
                    "planIdList": [],
                    "jobDirectionCodeList": [],
                    "workCityCodeList": [],
                    "positionDeptList": [],
                },
            }
            data = await self._post_json(url, body, headers=headers)
            body_data = (data or {}).get("body") or {}
            items = body_data.get("items") or []
            for it in items:
                records.append(self._raw_to_record(it))
            total = body_data.get("totalNumber") or 0
            if not items or page * page_size >= total:
                break
            page += 1
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        return {
            "job_id": it.get("publishId") or it.get("id"),
            "company": self.company_name,
            "title": it.get("positionName"),
            "recruit_type": it.get("planName") or "校招",
            "job_category": it.get("jobDirection"),
            "job_function": it.get("jobDirectionName"),
            "work_city": it.get("workCity") or it.get("workCityName"),
            "work_cities": [it["workCity"]] if it.get("workCity") else [],
            "team_intro": "",
            "responsibilities": it.get("workContent") or "",
            "requirements": it.get("qualification") or "",
            "bonus_points": "",
            "tags": it.get("tagList") or [],
            "publish_time": it.get("publishTime") or it.get("createTime"),
            "fetched_at": None,
            # 京东校招岗位详情需登录，无公开页面 URL（此前误用 API 路径，已废弃）
            "detail_url": None,
            "source_page": self.company["name"],
        }
