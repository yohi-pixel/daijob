"""MokaHR 招聘 SaaS 适配器

统一接口（响应 AES-128-CBC 加密，解密算法已实测）：
  POST {host}/api/outer/ats-apply/website/jobs/v2
  body: {"orgId":"<org>","siteId":"<site>","limit":50,"offset":0,
         "isCampusJob":true,"locale":"zh-CN"}
  响应: {"data":"<AES密文>","necromancer":"<key>"}
  解密: AES-128-CBC/Pkcs7，key=响应 necromancer 字段(hex)，
        iv=页面 HTML <input id="init-data"> 的 aesIv 字段(hex)

覆盖 7 家（orgId/siteId 见 companies.json）：
  唯品会 vipshophr / 诗悦 shiyuehr / 微博 sina / 韶音 aftershokzhr /
  钛动 tec-do / 完美世界 pwrd / 滴滴 didiglobal
"""
from __future__ import annotations

import base64
import json
import re
from typing import Any

from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

from .base import BaseAdapter

_AES_KEY_SIZE = 16


def aes_cbc_decrypt(cipher_b64: str, key_str: str, iv_str: str) -> dict[str, Any]:
    """解密 MokaHR 响应 data。

    实测：key=响应 necromancer 字段(16 字符)、iv=页面 aesIv(16 字符)，
    均按 UTF-8 直接编码为 16 字节使用（非 hex 解码）。
    """
    key = key_str.encode("utf-8")
    iv = iv_str.encode("utf-8")
    cipher = AES.new(key, AES.MODE_CBC, iv)
    raw = unpad(cipher.decrypt(base64.b64decode(cipher_b64)), AES.block_size)
    return json.loads(raw.decode("utf-8"))


class MokahrAdapter(BaseAdapter):
    company_ids = ["vipshop", "shiyue", "weibo", "shokz", "tecdo", "wanmei", "didichuxing"]

    async def fetch_jobs(self) -> list[dict[str, Any]]:
        api = self.company["api"]
        host = api.get("host", "app.mokahr.com")
        path = api.get("path", "/api/outer/ats-apply/website/jobs/v2")
        url = f"https://{host}{path}"
        org_id = self.company.get("org_id") or self._org_from_url() or api.get("body", {}).get("orgId")
        site_id = self.company.get("site_id") or self._site_from_url() or api.get("body", {}).get("siteId")
        if not org_id:
            raise ValueError(f"{self.company['name']} 缺少 orgId")

        # 1. 先 GET 门户页面拿 cookie + init-data(aesIv)
        portal_url = self.company.get("recruit_url") or f"https://{host}/campus-recruitment/{org_id}"
        aes_iv = await self._get_aes_iv(portal_url)

        records: list[dict[str, Any]] = []
        offset = 0
        limit = 50
        while True:
            body = {
                "orgId": org_id,
                "siteId": site_id or "",
                "limit": limit,
                "offset": offset,
                "isCampusJob": True,
                "locale": "zh-CN",
            }
            data = await self._post_json(
                url,
                body,
                headers={
                    "Referer": portal_url,
                    "Origin": f"https://{host}",
                    "X-Requested-With": "XMLHttpRequest",
                },
            )
            plain = aes_cbc_decrypt(data["data"], data["necromancer"], aes_iv)
            jobs = ((plain or {}).get("data") or {}).get("jobs") or []
            for j in jobs:
                records.append(self._raw_to_record(j))
            total = ((plain or {}).get("data") or {}).get("jobStats", {}).get("total", 0)
            offset += limit
            if not jobs or offset >= total:
                break

        return [self.normalize_record(r) for r in records]

    async def _get_aes_iv(self, portal_url: str) -> str:
        """从门户页面 HTML 的 init-data input 提取 aesIv。"""
        assert self.client is not None
        # MokaHR 首次访问 302 跳转，需 follow_redirects 拿最终 HTML
        resp = await self.client.get(
            portal_url,
            headers=self._headers(),
            timeout=20,
            follow_redirects=True,
        )
        html = resp.text
        m = re.search(r'id="init-data"[^>]*value="([^"]+)"', html)
        if not m:
            raise ValueError(f"{self.company['name']} 门户页未找到 init-data（可能需要 cookie 或不同入口）")
        try:
            init = json.loads(html_unescape(m.group(1)))
            return init["aesIv"]
        except Exception as e:
            raise ValueError(f"{self.company['name']} init-data 解析失败: {e}")

    def _org_from_url(self) -> str | None:
        m = re.search(r"/campus-recruitment/([^/]+)", self.company.get("recruit_url") or "")
        return m.group(1) if m else None

    def _site_from_url(self) -> str | None:
        m = re.search(r"/campus-recruitment/[^/]+/(\d+)", self.company.get("recruit_url") or "")
        return m.group(1) if m else None

    def _raw_to_record(self, j: dict[str, Any]) -> dict[str, Any]:
        # MokaHR 返回 title 可能含 HTML 实体/span 标签
        title = re.sub(r"<[^>]+>", "", str(j.get("title") or "")).strip()
        detail_url = self._detail_url(j)
        # 城市：job.locations 含 provinceName（如"北京市"）/cityName（如"朝阳区"）
        # 优先省名（市级粒度，去"市"字后与平台归一化一致）
        locations = j.get("locations") or []
        cities: list[str] = []
        for loc in locations:
            if not isinstance(loc, dict):
                continue
            name = loc.get("provinceName") or loc.get("cityName") or ""
            if name and name not in cities:
                cities.append(name)
        return {
            "job_id": j.get("id") or j.get("jobId"),
            "company": self.company_name,
            "title": title,
            "recruit_type": "校招" if j.get("showIsCampus") else None,
            "job_category": j.get("category2Id"),
            "job_function": None,
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": "",
            "responsibilities": "",
            "requirements": "",
            "bonus_points": "",
            "tags": j.get("tags") or [],
            "publish_time": j.get("publishedAt") or j.get("openedAt"),
            "fetched_at": None,
            "detail_url": detail_url,
            "source_page": self.company["name"],
        }

    def _detail_url(self, j: dict[str, Any]) -> str:
        org = self.company.get("org_id") or self._org_from_url() or ""
        site = self.company.get("site_id") or self._site_from_url() or ""
        host = self.company.get("api", {}).get("host", "app.mokahr.com")
        return f"https://{host}/campus-recruitment/{org}/{site}/apply/{j.get('id')}"


def html_unescape(s: str) -> str:
    return (
        s.replace("&quot;", '"')
        .replace("&#34;", '"')
        .replace("&amp;", "&")
        .replace("&#x27;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )
