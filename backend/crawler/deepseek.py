"""DeepSeek 适配器（自建 SPA，岗位 JSON 内嵌在 main.js 静态字面量）

调研结论（2026-08-20）：
- talent.deepseek.com 是 530B 的 SPA 壳，岗位数据内嵌在 /static/main.{hash}.js 的
  "jobs":[...] JSON 字面量中（构建时从 MokaHR high-flyer/140576 抓取，total=33）
- JS 内 JSON 是 JS 字符串转义（\\" -> \"），需做一层 \\ -> \ 还原后 json.loads
- 字段：id/title/functionName/locations/descriptionHtml/detailUrl/submitUrl
- 无独立岗位 API；静态抓取 main.js 即可（简单、稳定）
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .base import BaseAdapter, DEFAULT_UA

MAIN_JS_URL = "https://talent.deepseek.com/static/main.{hash}.js"


class DeepSeekAdapter(BaseAdapter):
    company_ids = ["deepseek"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        # 1. 抓 SPA 壳拿 main.js 文件名
        assert self.client is not None
        resp = await self.client.get(
            "https://talent.deepseek.com/",
            headers={"User-Agent": DEFAULT_UA},
            timeout=20,
        )
        html = resp.text
        m = re.search(r'src="(/static/main\.[^"]+\.js)"', html)
        if not m:
            return []
        js_url = f"https://talent.deepseek.com{m.group(1)}"

        # 2. 下载 main.js，提取 "jobs":[...] JSON 字面量
        r2 = await self.client.get(
            js_url,
            headers={"User-Agent": DEFAULT_UA},
            timeout=30,
        )
        js = r2.text
        idx = js.find('"jobs":')
        if idx == -1:
            return []
        start = js.find("[", idx)
        depth = 0
        end = start
        for i in range(start, len(js)):
            if js[i] == "[":
                depth += 1
            elif js[i] == "]":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        raw = js[start:end]
        # JS 字符串一层转义还原（\\" -> \"、\\n -> \n 等）
        jobs = json.loads(raw.replace("\\\\", "\\"))
        records = [self._raw_to_record(j) for j in jobs]
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        locations = it.get("locations") or []
        cities: list[str] = []
        for loc in locations:
            # "北京市 海淀区" / "浙江 拱墅区" —— 取省/市级部分
            parts = str(loc).split()
            if parts:
                city = parts[0].replace("省", "").replace("市", "")
                if city not in cities:
                    cities.append(city)
        desc = re.sub(r"<[^>]+>", "", str(it.get("descriptionHtml") or "")).strip()
        return {
            "job_id": it.get("id"),
            "company": self.company_name,
            "title": it.get("title"),
            "recruit_type": "校招",
            "job_category": it.get("functionName"),
            "job_function": None,
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": "",
            "responsibilities": desc,
            "requirements": "",
            "bonus_points": "",
            "tags": [],
            "publish_time": None,
            "fetched_at": None,
            "detail_url": it.get("detailUrl") or it.get("submitUrl"),
            "source_page": self.company["name"],
        }
