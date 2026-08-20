"""飞书 Hire 招聘 SaaS 适配器（字节/影石/叠纸/小米，实测无签名直连）

统一接口（Playwright 抓包确认，_signature 非必需）：
  POST {host}/api/v1/search/job/posts?keyword=&limit=10&offset=0&
       job_category_id_list=&tag_id_list=&location_code_list=&subject_id_list=&
       recruitment_id_list=&portal_type={n}&job_function_id_list=&storefront_id_list=
       &portal_entrance=1
  body: {"keyword":"","limit":10,"offset":0,"job_category_id_list":[],"tag_id_list":[],
         "location_code_list":[],"subject_id_list":[],"recruitment_id_list":[],
         "portal_type":{n},"job_function_id_list":[],"storefront_id_list":[],
         "portal_entrance":1}
  响应: {"code":0,"data":{"job_post_list":[{id,title,description,requirement,
         job_category,city_info,...}]}}  # limit/offset 分页

portal_type：字节=3，影石=6，叠纸=6，小米=6（飞书 hire 站点编号）
"""
from __future__ import annotations

from typing import Any

from .base import BaseAdapter


class FeishuHireAdapter(BaseAdapter):
    company_ids = ["bytedance", "insta360", "papegames", "xiaomi"]

    #: 各企业 portal_type（飞书 hire 站点编号，实测）
    PORTAL_TYPES = {"bytedance": 3, "insta360": 6, "papegames": 6, "xiaomi": 6}

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        host = self.company.get("api", {}).get("host") or self._host_from_url()
        portal_type = self.PORTAL_TYPES.get(self.company["id"], 6)
        records: list[dict[str, Any]] = []
        offset = 0
        limit = 10  # 实测飞书 hire 接口 limit>10 返回 405
        # 接口校验 UA（简化 UA 返回 405），必须完整浏览器 UA
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            ),
            "Referer": f"https://{host}/",
            "Origin": f"https://{host}",
        }
        max_pages = 400  # 防无限分页（字节全站岗位约 2000+）
        pages = 0
        while True:
            pages += 1
            if pages > max_pages:
                break
            url = (
                f"https://{host}/api/v1/search/job/posts"
                f"?keyword=&limit={limit}&offset={offset}"
                f"&job_category_id_list=&tag_id_list=&location_code_list="
                f"&subject_id_list=&recruitment_id_list="
                f"&portal_type={portal_type}&job_function_id_list="
                f"&storefront_id_list=&portal_entrance=1"
            )
            body = {
                "keyword": "",
                "limit": limit,
                "offset": offset,
                "job_category_id_list": [],
                "tag_id_list": [],
                "location_code_list": [],
                "subject_id_list": [],
                "recruitment_id_list": [],
                "portal_type": portal_type,
                "job_function_id_list": [],
                "storefront_id_list": [],
                "portal_entrance": 1,
            }
            data = await self._post_json(url, body, headers=headers)
            posts = ((data or {}).get("data") or {}).get("job_post_list") or []
            for p in posts:
                records.append(self._raw_to_record(p))
            # 飞书 hire 无 total 字段，offset 递增直到返回空
            if len(posts) < limit:
                break
            offset += limit
        return [self.normalize_record(r) for r in records]

    def _host_from_url(self) -> str:
        from urllib.parse import urlparse

        return urlparse(self.company.get("recruit_url") or "").netloc

    def _raw_to_record(self, p: dict[str, Any]) -> dict[str, Any]:
        # 城市：city_info 结构不一，取 cityName/location 等
        cities: list[str] = []
        ci = p.get("city_info")
        if isinstance(ci, list):
            for c in ci:
                if isinstance(c, dict):
                    name = c.get("city_name") or c.get("name") or c.get("cityName")
                    if name and name not in cities:
                        cities.append(str(name))
        elif isinstance(ci, dict):
            name = ci.get("city_name") or ci.get("name") or ci.get("cityName")
            if name:
                cities = [str(name)]
        # 描述/要求可能含 HTML 标签
        import re as _re

        desc = _re.sub(r"<[^>]+>", "", str(p.get("description") or "")).strip()
        req = _re.sub(r"<[^>]+>", "", str(p.get("requirement") or "")).strip()
        return {
            "job_id": p.get("id") or p.get("post_id"),
            "company": self.company_name,
            "title": p.get("title"),
            "recruit_type": "校招",
            "job_category": p.get("job_category") or p.get("jobCategoryName"),
            "job_function": p.get("job_function_name") or p.get("jobFunctionName"),
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": "",
            "responsibilities": desc,
            "requirements": req,
            "bonus_points": "",
            "tags": [],
            "publish_time": p.get("publish_time") or p.get("publishTime"),
            "fetched_at": None,
            "detail_url": p.get("url") or p.get("detail_url"),
            "source_page": self.company["name"],
        }
