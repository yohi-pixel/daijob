"""快手适配器（Playwright 响应拦截）

调研结论（2026-08-20 实测）：
- 快手校招（campus.kuaishou.cn）岗位列表必须登录，未登录弹"请先进行登录"，接口返回 500
- 公开可采的是「日常实习」入口：zhaopin.kuaishou.cn/recruit/e/#/official/trainee/
  - 岗位接口：GET /recruit/e/api/v1/open/positions/simple?pageNum&pageSize=10&positionNatureCode=C002&workLocationCode=domestic
  - 该接口依赖页面 JS 运行时签名：httpx 直连/页面内 fetch 均报"系统错误"，必须用浏览器拦截响应
  - 城市字典：GET /recruit/e/api/v1/open/positions/label?channelCode=G002&positionNatureCode=C002 可直连
- recruitProjectCode=socialr + positionNatureCode=C002 → 日常实习岗位
"""
from __future__ import annotations

import asyncio
import re
import time
from typing import Any

from playwright.sync_api import sync_playwright

from .base import BaseAdapter, DEFAULT_UA

CITY_CODE_URL = (
    "https://zhaopin.kuaishou.cn/recruit/e/api/v1/open/positions/label"
    "?channelCode=G002&positionNatureCode=C002"
)
LIST_URL = (
    "https://zhaopin.kuaishou.cn/recruit/e/#/official/trainee/?workLocationCode=domestic"
)


#: 兜底城市 code 映射（label 接口不可用时避免英文 code 被 normalize 层误判为"海外"）
FALLBACK_CITIES = {
    "Beijing": "北京", "Shanghai": "上海", "Shenzhen": "深圳", "Guangzhou": "广州",
    "Hangzhou": "杭州", "Chengdu": "成都", "Tianjin": "天津", "Shenyang": "沈阳",
    "Changchun": "长春", "Tongren": "铜仁", "Suzhou": "苏州", "Wuhan": "武汉",
    "Nanjing": "南京", "Xian": "西安", "Xi'an": "西安", "Chongqing": "重庆",
    "Changsha": "长沙", "Zhengzhou": "郑州", "Qingdao": "青岛", "Jinan": "济南",
    "Hefei": "合肥", "Xiamen": "厦门", "Fuzhou": "福州", "Kunming": "昆明",
    "Haikou": "海口", "Guiyang": "贵阳", "Nanchang": "南昌", "Shijiazhuang": "石家庄",
    "Harbin": "哈尔滨", "Dalian": "大连", "Ningbo": "宁波", "Wuxi": "无锡",
    "Dongguan": "东莞", "Foshan": "佛山", "Zhuhai": "珠海", "Hong Kong": "香港",
    "Macao": "澳门", "Taipei": "台北", "Los Angeles": "洛杉矶", "New York": "纽约",
    "Singapore": "新加坡", "London": "伦敦", "Tokyo": "东京", "Paris": "巴黎",
    "Berlin": "柏林", "Sydney": "悉尼", "Moscow": "莫斯科", "Baku": "巴库",
    "Tashkent": "塔什干", "domestic": "中国", "overseas": "海外",
}


class KuaishouAdapter(BaseAdapter):
    """快手日常实习岗位（唯一公开入口，校招需登录）。

    岗位接口依赖页面 JS 运行时签名（httpx 直连报"系统错误"），
    必须用 Playwright 打开页面 + 拦截响应 + 点击分页。
    因 runner 是 asyncio 环境，Playwright 同步逻辑放到 _sync_fetch_items，
    经 asyncio.to_thread 调用。
    """

    company_ids = ["kuaishou"]

    def __init__(self, company: dict[str, Any], client: Any = None):
        super().__init__(company, client)
        self._city_map: dict[str, str] = {}

    def _fetch_city_map(self) -> dict[str, str]:
        """label 接口拿城市 code -> 中文名 映射（需先访问页面建立 cookie 会话）。"""
        import httpx

        city_map: dict[str, str] = {}
        try:
            with httpx.Client(
                headers={"User-Agent": DEFAULT_UA}, timeout=15, follow_redirects=True
            ) as c:
                # 先访问页面拿 cookie（label 接口依赖会话）
                c.get("https://zhaopin.kuaishou.cn/recruit/e/#/official/trainee/")
                r = c.get(CITY_CODE_URL)
                d = r.json()
                result = d.get("result") or {}
                for group in result.values():
                    for item in group or []:
                        code = item.get("code")
                        name = item.get("name")
                        if code and name:
                            city_map[code] = name
                        for child in item.get("children") or []:
                            if child.get("code") and child.get("name"):
                                city_map[child["code"]] = child["name"]
        except Exception:
            pass
        # 兜底：内置映射补齐
        city_map.update({k: v for k, v in FALLBACK_CITIES.items() if k not in city_map})
        return city_map

    def _sync_fetch_items(self) -> list[dict[str, Any]]:
        """同步版：打开页面 + 拦截响应 + 翻页。"""
        raw_items: list[dict[str, Any]] = []
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=DEFAULT_UA)
            page = ctx.new_page()

            def on_response(resp):
                if "positions/simple" in resp.url:
                    try:
                        d = resp.json()
                        lst = (d.get("result") or {}).get("list") or []
                        raw_items.extend(lst)
                    except Exception:
                        pass

            page.on("response", on_response)
            page.goto(LIST_URL, wait_until="networkidle", timeout=60000)
            time.sleep(3)

            # 点击"下一页"循环翻页（antd 分页 next 有效，页码按钮无效），直到按钮禁用
            max_pages = 120  # 安全上限（1102/10 ≈ 111 页）
            for _ in range(max_pages):
                before = len(raw_items)
                next_btn = page.query_selector(".ant-pagination-next")
                if not next_btn or "ant-pagination-disabled" in (
                    next_btn.get_attribute("class") or ""
                ):
                    break
                try:
                    next_btn.click()
                except Exception:
                    break
                # 等待新响应（最多 10s）
                waited = 0
                while len(raw_items) == before and waited < 10:
                    time.sleep(0.5)
                    waited += 0.5
                if len(raw_items) == before:
                    break  # 翻页无新数据，结束

            browser.close()
        return raw_items

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        self._city_map = self._fetch_city_map()
        raw_items = await asyncio.to_thread(self._sync_fetch_items)
        records = [self._raw_to_record(it) for it in raw_items]
        return [self.normalize_record(r) for r in records]

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        codes = it.get("workLocationsCode") or []
        cities = [self._city_map.get(c, c) for c in codes if c]
        cities = [c for c in cities if c]
        title = it.get("name") or ""
        salary = ""
        if it.get("salaryMin") or it.get("salaryMax"):
            salary = f"{it.get('salaryMin')}-{it.get('salaryMax')}"
        return {
            "job_id": it.get("id"),
            "company": self.company_name,
            "title": title,
            "recruit_type": "实习",  # 公开入口仅日常实习（校招需登录）
            "job_category": it.get("positionCategoryCode"),
            "job_function": it.get("departmentName"),
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": "",
            "responsibilities": it.get("description") or "",
            "requirements": it.get("positionDemand") or "",
            "bonus_points": salary or "",
            "tags": [salary] if salary else [],
            "publish_time": it.get("updateTime"),
            "fetched_at": None,
            "detail_url": f"https://zhaopin.kuaishou.cn/recruit/e/#/official/trainee/?id={it.get('id')}",
            "source_page": self.company["name"],
        }
