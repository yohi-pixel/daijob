"""网易校招适配器（campus.163.com，GET 分页，实测可直连）

接口：
  GET https://campus.163.com/api/campuspc/position/getJobList
      ?projectId={id}&pageNum=1&pageSize=10
  响应: {"code":200,"data":{"total":50,"pages":5,"list":[
        {"id":4811,"positionName":"营销运营专员","positionTypeName":"运营",
         "workPlaceName":"杭州","interviewCityName":"远程面试",
         "positionDescription","positionRequirement","isHot","tagList","updateTime"}]}}
  projectId：103=网易互联网2027届（校招）；102=互娱（走 campus.game.163.com）

注意：POST 会返回 code:402 请求方式错误，必须 GET。
"""
from __future__ import annotations

from typing import Any

from .base import BaseAdapter


class NeteaseAdapter(BaseAdapter):
    company_ids = ["netease", "netease-leihuo"]

    #: 网易互联网校招 projectId（2027届）；互娱走独立站点暂用同一接口不同 id
    PROJECT_IDS = {"netease": 103, "netease-leihuo": 102}

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        project_id = self.PROJECT_IDS.get(self.company["id"], 103)
        records: list[dict[str, Any]] = []
        page = 1
        page_size = 50
        headers = {"Referer": "https://campus.163.com/"}
        while True:
            url = (
                f"https://campus.163.com/api/campuspc/position/getJobList"
                f"?projectId={project_id}&pageNum={page}&pageSize={page_size}"
            )
            data = await self._get_json(url, headers=headers)
            body = (data or {}).get("data") or {}
            items = body.get("list") or []
            for it in items:
                records.append(self._raw_to_record(it))
            total = body.get("total") or 0
            if not items or page * page_size >= total:
                break
            page += 1
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        return {
            "job_id": it.get("id"),
            "company": self.company_name,
            "title": it.get("positionName"),
            "recruit_type": "校招",
            "job_category": it.get("positionTypeName"),
            "job_function": None,
            "work_city": it.get("workPlaceName"),
            "work_cities": [it["workPlaceName"]] if it.get("workPlaceName") else [],
            "team_intro": "",
            "responsibilities": it.get("positionDescription") or "",
            "requirements": it.get("positionRequirement") or "",
            "bonus_points": "",
            "tags": it.get("tagList") or [],
            "publish_time": it.get("updateTime"),
            "fetched_at": None,
            "detail_url": f"https://campus.163.com/app/job/position?id={it.get('id')}",
            "source_page": self.company["name"],
        }
