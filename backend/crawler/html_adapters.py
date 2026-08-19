"""HTML 解析适配器（中芯国际 / 荔枝FM）

- smics.zhiye.com/campus：北森 CMS SSR，<li><a> 内含 5 个 span：
  类别 / 标题（含 J 编号） / 学历 / 工作地点 / "查看职位"，详情链接 /campusxq?jobId=
- jobs.lizhiinc.com：PHP 多页站，列表带 ?key= 参数，详情独立 URL
"""
from __future__ import annotations

import re
from typing import Any

from .base import BaseAdapter


class SmicAdapter(BaseAdapter):
    """中芯国际（北森 CMS，SSR 表格可解析，含城市/学历）"""

    company_ids = ["smic"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        url = "https://smics.zhiye.com/campus"
        assert self.client is not None
        resp = await self.client.get(url, headers=self._headers(), timeout=20)
        html = resp.text
        records = []

        # 每个 <li><a href="/campusxq?..."> ... 5 个 span ... </a></li>
        items = re.findall(
            r'<a href="(/campusxq\?[^"]+)"[^>]*>\s*'
            r"<span[^>]*>([^<]*)</span>\s*"  # 类别
            r"<span[^>]*>([^<]*)</span>\s*"  # 标题
            r"<span[^>]*>([^<]*)</span>\s*"  # 学历
            r"<span[^>]*>([^<]*)</span>\s*"  # 工作地点
            r"<span[^>]*>.*?</span>\s*</a>",
            html,
            re.S,
        )
        for href, category, title, degree, city in items:
            title = title.strip()
            if not title:
                continue
            m = re.search(r"\(?(J\d+)\)?", title)
            job_id = m.group(1) if m else re.search(r"jobId=(\d+)", href).group(1)
            # 标题去 J 编号
            clean_title = re.sub(r"\s*\(J\d+\)\s*$", "", title)
            records.append({
                "job_id": job_id,
                "company": self.company_name,
                "title": clean_title,
                "recruit_type": "校招" if "校招" in title else None,
                "job_category": category.strip(),
                "job_function": None,
                "work_city": city.strip(),
                "work_cities": [city.strip()] if city.strip() else [],
                "team_intro": "",
                "responsibilities": "",
                "requirements": f"学历要求：{degree.strip()}" if degree.strip() else "",
                "bonus_points": "",
                "tags": [],
                "publish_time": None,
                "fetched_at": None,
                "detail_url": f"https://smics.zhiye.com{href}",
                "source_page": self.company["name"],
            })
        return [self.normalize_record(r) for r in records]


class LizhiAdapter(BaseAdapter):
    """荔枝FM（PHP 站，recruit 页含校招岗位，详情链接 /job/recruit/detail/{id}.html）"""

    company_ids = ["ximalaya", "lizhi"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        base = "https://jobs.lizhiinc.com/job/recruit/index.html"
        assert self.client is not None
        resp = await self.client.get(base, headers=self._headers(), timeout=20)
        html = resp.text
        records = []

        # 岗位条目：<a href="/job/recruit/detail/{id}.html" class="rightBlock_Fx">
        #           <h2>岗位名</h2> ...（标题在嵌套 h2 内）
        items = re.findall(
            r'<a[^>]+href="(/job/recruit/detail/\d+\.html)"[^>]*>'
            r'[\s\S]{0,200}?<h2>([^<]{2,50})</h2>',
            html,
        )
        for href, title in items:
            title = title.strip()
            if not title:
                continue
            m = re.search(r"/detail/(\d+)", href)
            job_id = m.group(1) if m else href
            records.append({
                "job_id": job_id,
                "company": self.company_name,
                "title": title,
                "recruit_type": "校招",
                "job_category": None,
                "job_function": None,
                "work_city": None,
                "work_cities": [],
                "team_intro": "",
                "responsibilities": "",
                "requirements": "",
                "bonus_points": "",
                "tags": [],
                "publish_time": None,
                "fetched_at": None,
                "detail_url": f"https://jobs.lizhiinc.com{href}",
                "source_page": self.company["name"],
            })
        return [self.normalize_record(r) for r in records]
