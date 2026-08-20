"""飞书 Hire 招聘 SaaS 适配器（字节/影石/叠纸/小米）—— Playwright 响应拦截版

重要结论（2026-08-20 实测）：
- 统一接口 POST {host}/api/v1/search/job/posts，limit≤10（>10 返回 405）、完整 UA 必须
- **校招/社招由请求上下文区分**：
  - httpx 直连（无签名）→ 返回社招岗（recruit_type=101 正式，如"机器学习/检测算法高级工程师"）
  - 浏览器校招页自身 XHR（动态 _signature + channel=campus cookie）→ 返回校招岗
    （recruit_type=201 正式应届 / 202 实习，如"创意产品实习生-TikTok"）
  - 校招项目过滤参数 subject_id_list（如字节 2027届校园招聘=7649336829398468869），
    httpx 直连带该参数返回 count=0（签名环境外无效）
- 因此本适配器必须用 Playwright 打开各校招 URL，拦截页面自身 XHR 响应，
  滚动（window.scrollTo 到底部）触发懒加载翻页，直到无新响应

各校招 URL（recruit_url 已在 companies.json 配置）：
- 字节：https://jobs.bytedance.com/campus/position
- 影石：https://arashivision.jobs.feishu.cn/campus
- 叠纸：https://career.papegames.com/campus/position/list
- 小米：https://xiaomi.jobs.f.mioffice.cn/campus/
"""
from __future__ import annotations

import asyncio
import re
import time
from typing import Any

from playwright.sync_api import sync_playwright

from .base import BaseAdapter

#: recruit_type.id -> 中文（仅校招站上下文内的类型）
RT_NAMES = {"201": "校招-正式", "202": "校招-实习", "301": "实习"}


class FeishuHireAdapter(BaseAdapter):
    company_ids = ["bytedance", "insta360", "papergames", "xiaomi"]

    def _sync_fetch_items(self) -> list[dict[str, Any]]:
        """同步版：打开校招 URL + 拦截 job/posts 响应 + 滚动翻页。"""
        url = self.company.get("recruit_url") or ""
        raw_items: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            ctx = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
                )
            )
            page = ctx.new_page()

            def on_response(resp):
                if "/job/posts" not in resp.url:
                    return
                try:
                    d = resp.json()
                    posts = ((d or {}).get("data") or {}).get("job_post_list") or []
                    for p in posts:
                        # 只保留校招站上下文岗位（201 校招正式 / 202 校招实习 / 301 实习），
                        # 排除 101 正式（社招）——防止签名环境外混入社招
                        rt = str((p.get("recruit_type") or {}).get("id") or "")
                        if rt and rt not in ("201", "202", "301"):
                            continue
                        pid = str(p.get("id") or "")
                        if pid and pid in seen_ids:
                            continue
                        if pid:
                            seen_ids.add(pid)
                        raw_items.append(p)
                except Exception:
                    pass

            page.on("response", on_response)
            page.goto(url, wait_until="networkidle", timeout=60000)
            time.sleep(4)

            # 滚动到底部触发懒加载，直到响应不再增加
            max_scrolls = 500  # 安全上限
            for _ in range(max_scrolls):
                before = len(raw_items)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(1.2)
                if len(raw_items) == before:
                    # 再滚一次确认（懒加载可能有延迟）
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(2)
                if len(raw_items) == before:
                    break

            browser.close()
        return raw_items

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        raw_items = await asyncio.to_thread(self._sync_fetch_items)
        records = [self._raw_to_record(p) for p in raw_items]
        return [self.normalize_record(r) for r in records]

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
