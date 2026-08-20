"""飞书 Hire 招聘 SaaS 适配器（字节/影石/叠纸/小米）—— httpx 直连版（最终版）

重大突破（2026-08-20 实测）：
- 统一接口 POST {host}/api/v1/search/job/posts，limit≤10（>10 返回 405）、完整 UA 必须
- **校招/社招由请求头区分**（非签名！）：
  - 不带 portal 头 → 返回社招岗（recruit_type=101 正式，如"机器学习/检测算法高级工程师"）
  - 带 3 个自定义头 → 返回校招岗（recruit_type=201 校招正式 / 202 校招实习）：
    - website-path: campus
    - portal-channel: campus
    - portal-platform: pc
- **offset 翻页有效**（无需 Playwright/懒加载）：每家全量可采
  - 字节 count=7428 / 小米 737 / 影石 318 / 叠纸 48
- 之前 Playwright 拦截版废弃（每家仅首屏 10 条），本版为最终实现

portal_type：字节=3，影石=6，叠纸=6，小米=6
"""
from __future__ import annotations

import re
from typing import Any

from .base import BaseAdapter, DEFAULT_UA

#: recruit_type.id -> 中文
RT_NAMES = {"201": "校招-正式", "202": "校招-实习", "301": "实习"}

#: 校招门户自定义请求头（关键：决定接口返回校招而非社招）
PORTAL_HEADERS = {
    "website-path": "campus",
    "portal-channel": "campus",
    "portal-platform": "pc",
}


class FeishuHireAdapter(BaseAdapter):
    company_ids = ["bytedance", "insta360", "papergames", "xiaomi", "xpeng"]

    #: 各企业 portal_type（飞书 hire 站点编号，实测）
    PORTAL_TYPES = {"bytedance": 3, "insta360": 6, "papergames": 6, "xiaomi": 6, "xpeng": 6}

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        host = self.company.get("api", {}).get("host") or self._host_from_url()
        portal_type = self.PORTAL_TYPES.get(self.company["id"], 6)
        referer = self.company.get("recruit_url") or f"https://{host}/"
        records: list[dict[str, Any]] = []
        offset = 0
        limit = 10
        max_pages = 1000  # 安全上限（字节全站 7428 条 ≈ 743 页）
        headers = {
            "User-Agent": DEFAULT_UA,
            "Referer": referer,
            "Origin": f"https://{host}",
            **PORTAL_HEADERS,
        }
        for _ in range(max_pages):
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
                # 只保留校招岗（201/202/301），排除 101 社招（保险）
                rt = str((p.get("recruit_type") or {}).get("id") or "")
                if rt and rt not in ("201", "202", "301"):
                    continue
                records.append(self._raw_to_record(p))
            if len(posts) < limit:
                break
            offset += limit
        return [self.normalize_record(r) for r in records]

    def _host_from_url(self) -> str:
        from urllib.parse import urlparse

        return urlparse(self.company.get("recruit_url") or "").netloc

    def _raw_to_record(self, p: dict[str, Any]) -> dict[str, Any]:
        # 城市：city_info（字节/小米 dict）与 city_list（影石 list）都可能携带
        cities: list[str] = []
        ci = p.get("city_info")
        if isinstance(ci, list):
            for c in ci:
                if isinstance(c, dict):
                    name = c.get("name") or c.get("city_name") or c.get("cityName")
                    if name and name not in cities:
                        cities.append(str(name))
        elif isinstance(ci, dict):
            name = ci.get("name") or ci.get("city_name") or ci.get("cityName")
            if name and name not in cities:
                cities.append(str(name))
        cl = p.get("city_list")
        if isinstance(cl, list):
            for c in cl:
                if isinstance(c, dict):
                    name = c.get("name") or c.get("city_name") or c.get("cityName")
                    if name and name not in cities:
                        cities.append(str(name))

        rt = (p.get("recruit_type") or {}).get("id")
        rt_name = RT_NAMES.get(str(rt), "校招")

        desc = re.sub(r"<[^>]+>", "", str(p.get("description") or "")).strip()
        req = re.sub(r"<[^>]+>", "", str(p.get("requirement") or "")).strip()
        return {
            "job_id": p.get("id") or p.get("post_id"),
            "company": self.company_name,
            "title": p.get("title"),
            "recruit_type": rt_name,
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
