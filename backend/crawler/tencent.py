"""腾讯校招适配器（join.qq.com，实测可用）

接口：
  POST https://join.qq.com/api/v1/position/searchPosition
  body: {"keyword":"","pageIndex":1,"pageSize":10,"lang":"zh-cn","recruitType":1}
  需 Referer: https://join.qq.com/
  响应: {status:0, data:{positionList:[{positionTitle, projectName, workCities,
        postId, positionFamily, bgs,...}]}}
"""
from __future__ import annotations

from typing import Any

from .base import BaseAdapter


class TencentAdapter(BaseAdapter):
    company_ids = ["tencent"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        url = "https://join.qq.com/api/v1/position/searchPosition"
        records: list[dict[str, Any]] = []
        page = 1
        page_size = 50
        while True:
            body = {"keyword": "", "pageIndex": page, "pageSize": page_size,
                    "lang": "zh-cn", "recruitType": 1}
            data = await self._post_json(url, body, headers={"Referer": "https://join.qq.com/"})
            pos_list = ((data or {}).get("data") or {}).get("positionList") or []
            for it in pos_list:
                records.append(self._raw_to_record(it))
            total = ((data or {}).get("data") or {}).get("totalCount") or 0
            if not pos_list or page * page_size >= total:
                break
            page += 1
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        # 实测：腾讯 workCities 为空格分隔的完整字符串
        # （"深圳总部 北京 上海 广州 成都"，城市名间无分隔符需按空格拆）
        raw = it.get("workCities") or ""
        cities = [c.strip() for c in str(raw).split() if c.strip()] if raw else []
        return {
            "job_id": it.get("postId") or it.get("id"),
            "company": self.company_name,
            "title": it.get("positionTitle") or it.get("postName"),
            "recruit_type": "校招" if it.get("recruitType") == 1 else None,
            "job_category": it.get("positionFamily"),
            "job_function": it.get("positionName"),
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": "",
            "responsibilities": it.get("responsibility") or "",
            "requirements": it.get("requirement") or "",
            "bonus_points": it.get("bgs") or "",
            "tags": [],
            "publish_time": None,
            "fetched_at": None,
            "detail_url": it.get("postUrl") or f"https://join.qq.com/post_detail.html?pid={it.get('postId')}",
            "source_page": self.company["name"],
        }
