"""北森 zhiye.com 适配器

统一接口（无需鉴权，已实测）：
  POST https://{site}.zhiye.com/api/Jobad/GetJobAdPageList
  body: {"pageIndex":1,"pageSize":50,"categoryId":2}   # categoryId 可省略=全部

覆盖（REAL 门户 4 家，tenantId 记录在案）：
  popmart(111276) / transsion(107447) / mindray(106239) / miniso(109979)
"""
from __future__ import annotations

from typing import Any

from .base import BaseAdapter

CATEGORY_HINTS = {"校招": 1, "实习": 2, "社招": 3}  # 依实测可调


class ZhiyeAdapter(BaseAdapter):
    company_ids = ["popmart", "transsion", "mindray", "miniso"]

    # 实测结论（2026-08-14）：该平台列表/详情接口均不返回城市、发布日期、薪资
    # （LocNames 空、PostDate=0001-01-01、Salary=None，非参数问题）。
    # 可用字段：JobAdName / Duty / Require / CategoryId。按"字段残缺源"处理。

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        site = self.company["api"]["host"]
        url = f"https://{site}/api/Jobad/GetJobAdPageList"
        records: list[dict[str, Any]] = []

        # 分页基数自适应：多数站点 pageIndex 从 1 开始，个别（名创）从 0 开始
        base = await self._detect_page_base(url)

        page = 0
        while True:
            body = {"pageIndex": base + page, "pageSize": 50}
            data = await self._post_json(url, body)
            items = (data or {}).get("Data") or []
            for it in items:
                records.append(self._raw_to_record(it))
            total = (data or {}).get("Count", 0)
            if len(records) >= total or not items:
                break
            page += 1

        return [self.normalize_record(r) for r in records]

    async def _detect_page_base(self, url: str) -> int:
        """探测 pageIndex 基数：pageIndex=0 有数据 → 0 起始，否则 1 起始。"""
        for idx, size in ((0, 1), (1, 1)):
            data = await self._post_json(url, {"pageIndex": idx, "pageSize": size})
            if (data or {}).get("Data"):
                return 0 if idx == 0 else 1
        return 1

    def _raw_to_record(self, it: dict[str, Any]) -> dict[str, Any]:
        title = it.get("JobAdName") or ""
        # 城市缺失（平台限制）：从标题尝试提取常见城市名作为兜底
        locs = it.get("LocNames") or []
        if not locs:
            from services.search_utils import normalize_city_token

            hit = next(
                (normalize_city_token(tok) for tok in _extract_city_tokens(title) if normalize_city_token(tok)),
                None,
            )
            if hit:
                locs = [hit]
        # 详情页：zhiye 无独立详情 URL，用列表页 + 查询参数
        detail_url = (
            f"https://{self.company['api']['host']}/"
            f"positiondetail?jobAdId={it.get('JobAdId')}"
        )
        return {
            "job_id": it.get("JobAdId") or it.get("Id"),
            "company": self.company_name,
            "title": title,
            "recruit_type": None,  # 平台不区分校招/社招
            "job_category": it.get("CategoryId"),
            "job_function": None,
            "work_city": locs[0] if locs else None,
            "work_cities": locs,
            "team_intro": "",
            "responsibilities": it.get("Duty") or "",
            "requirements": it.get("Require") or "",
            "bonus_points": it.get("Welfare") or "",
            "tags": it.get("Tags") or [],
            "publish_time": None,  # 平台不返回
            "fetched_at": None,
            "detail_url": detail_url,
            "source_page": self.company["name"],
        }


#: 标题中常见的城市名 token（用于城市兜底提取）
_CITY_TOKENS = [
    "北京", "上海", "深圳", "广州", "杭州", "南京", "武汉", "成都", "重庆",
    "西安", "苏州", "天津", "长沙", "郑州", "东莞", "佛山", "青岛", "宁波",
    "厦门", "福州", "合肥", "济南", "大连", "沈阳", "哈尔滨", "长春", "昆明",
    "贵阳", "南昌", "南宁", "太原", "石家庄", "兰州", "乌鲁木齐", "海口",
    "香港", "海外", "无锡", "常州", "珠海", "惠州", "中山",
]


def _extract_city_tokens(text: str) -> list[str]:
    """从标题文本提取可能出现的城市名（含"沈阳门店""杭州地区"等后缀场景）。"""
    hits = []
    for city in _CITY_TOKENS:
        if city in text:
            hits.append(city)
    return hits
