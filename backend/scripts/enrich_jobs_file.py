"""数据清洗增强脚本：时间格式统一 + 详情链接补全 + 异常值修正

背景（2026-09-29 数据体检发现）：
1. publish_time 形态混乱：Unix 毫秒 10645 条 / 格式化字符串 1083 条 / 空 2822 条
   → 导入 SQL 时 parse_publish_time 仅认 "%Y-%m-%d %H:%M:%S"，Unix 毫秒全部解析失败变 NULL，
     导致前端无法按时间排序/筛选、无法识别过期岗位
2. detail_url 缺失 11027 条（75.8%）——飞书 Hire 列表接口不返回 url 字段
   → 实测详情页模板：https://{host}/{prefix}/position/{job_id}/detail（Playwright 渲染验证通过）
3. 未来时间异常 47 条（publish_time 晚于当前时间）

用法：
  python -m scripts.enrich_jobs_file --input ../data/jobs.jsonl --in-place
  python -m scripts.enrich_jobs_file --input ../data/jobs.jsonl --output /tmp/out.jsonl
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.append(str(Path(__file__).resolve().parents[1]))

ROOT = Path(__file__).resolve().parents[2]
COMPANIES_FILE = ROOT / "data" / "companies.json"

#: 飞书 Hire 详情页模板（实测验证：/{prefix}/position/{id}/detail）
FEISHU_DETAIL_TEMPLATE = "https://{host}/{prefix}/position/{job_id}/detail"

#: 无法补全详情链接的企业（源站需登录或无独立详情页）
NO_DETAIL_REASON = {
    "美团": "岗位列表/详情需登录，无公开链接",
    "拼多多": "详情接口未返回 url 字段（待补）",
    "京东": "岗位详情需登录，无公开页面 URL",
}


def _is_valid_detail_url(url: Any) -> bool:
    """坏链检测：API 路径不是页面 URL（如 campus.jd.com/api/wx/position/detail/xxx）。"""
    if not url:
        return False
    s = str(url).strip()
    if s in ("", "None"):
        return False
    if "/api/" in s or "/api?" in s:
        return False
    return s.startswith("http")


def _load_feishu_prefix_map() -> dict[str, tuple[str, str]]:
    """从 companies.json 推导飞书系 {公司名: (host, prefix)}。"""
    data = json.loads(COMPANIES_FILE.read_text(encoding="utf-8"))
    mapping: dict[str, tuple[str, str]] = {}
    for c in data["companies"]:
        if c.get("platform") != "feishu":
            continue
        api = c.get("api") or {}
        host = api.get("host") or ""
        url = c.get("recruit_url") or ""
        if not host or not url:
            continue
        # 从 recruit_url 路径取第一段作为 prefix（campus / zhipucampus / 578078 / 379481）
        m = re.search(r"https?://[^/]+/([^/?#]+)", url)
        prefix = m.group(1) if m else "campus"
        if prefix in ("position", "jobs", "index"):
            prefix = "campus"
        mapping[c["name"]] = (host, prefix)
    return mapping


def parse_to_iso(value: Any, now: datetime | None = None) -> tuple[str | None, str]:
    """归一化时间为 '%Y-%m-%d %H:%M:%S'。返回 (iso_or_None, status)。"""
    now = now or datetime.now(timezone.utc)
    if value in (None, "", "None"):
        return None, "empty"
    s = str(value).strip()

    dt: datetime | None = None
    if re.fullmatch(r"\d{13}", s):
        dt = datetime.fromtimestamp(int(s) / 1000, tz=timezone.utc)
    elif re.fullmatch(r"\d{10}", s):
        dt = datetime.fromtimestamp(int(s), tz=timezone.utc)
    elif re.match(r"\d{4}-\d{2}-\d{2}", s):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(s[: len(fmt) + 4] if "%H" in fmt else s[:10], fmt)
                dt = dt.replace(tzinfo=timezone.utc)
                break
            except ValueError:
                continue

    if dt is None:
        return None, "unparsable"
    if dt > now:
        return None, "future"  # 未来时间视为异常，置空
    return dt.strftime("%Y-%m-%d %H:%M:%S"), "ok"


def build_detail_url(company: str, job_id: str, prefix_map: dict[str, tuple[str, str]]) -> str | None:
    if company not in prefix_map or not job_id:
        return None
    host, prefix = prefix_map[company]
    return FEISHU_DETAIL_TEMPLATE.format(host=host, prefix=prefix, job_id=job_id)


#: 城市别名（港澳按中国地名规范书写）
CITY_ALIAS = {
    "香港": "中国香港",
    "香港特别行政区": "中国香港",
    "澳门": "中国澳门",
    "澳门特别行政区": "中国澳门",
    "台湾": "中国台湾",
    "台湾省": "中国台湾",
}


def normalize_city(value: Any) -> tuple[str | None, bool]:
    """城市字段归一化。

    源站偶尔把省份、括号注释混进城市名，实测脏值：
      '广东省-深圳市'（15 条）→ '深圳市'
      '广东省（如肇庆'（1 条）→ '肇庆'
      '香港特别行政区'（1 条）→ '中国香港'
    """
    if value is None:
        return None, False
    s = str(value).strip()
    if not s or s in ("None", "null"):
        return None, False

    original = s

    # 括号里的往往才是真城市：'广东省（如肇庆' → '肇庆'
    m = re.match(r"^(?P<outside>[^（(【\[]*)[（(【\[](?P<inner>.*)$", s)
    if m:
        outside = m.group("outside").strip()
        inner = re.sub(r"^(如|例如|比如)\s*", "", m.group("inner").strip()).strip()
        s = inner or outside or s

    # 多段用分隔符拼接时取最后一段：'广东省-深圳市' → '深圳市'
    parts = [p for p in re.split(r"[-—–/、,，]+", s) if p.strip()]
    if parts:
        s = parts[-1].strip()

    # 落单的右括号：'东莞)' → '东莞'
    s = re.sub(r"^[）)】\]]+|[）)】\]]+$", "", s).strip()

    s = CITY_ALIAS.get(s, s)
    if not s:
        s = original
    return s, s != original


def enrich_record(
    record: dict[str, Any],
    prefix_map: dict[str, tuple[str, str]],
    now: datetime,
) -> tuple[dict[str, Any], dict[str, bool]]:
    r = dict(record)
    flags = {
        "time_normalized": False,
        "time_dropped": False,
        "url_filled": False,
        "bad_url_dropped": False,
        "city_normalized": False,
    }

    city, city_changed = normalize_city(r.get("work_city"))
    if city_changed:
        r["work_city"] = city
        flags["city_normalized"] = True

    # work_cities 是前端筛选与地图用的数组，同样要归一化（后端城市列表从它聚合）
    raw_cities = r.get("work_cities")
    if isinstance(raw_cities, list) and raw_cities:
        cleaned: list[str] = []
        for item in raw_cities:
            name, changed = normalize_city(item)
            if not name:
                continue
            if name not in cleaned:
                cleaned.append(name)
            if changed:
                flags["city_normalized"] = True
        if cleaned != raw_cities:
            r["work_cities"] = cleaned

    iso, status = parse_to_iso(r.get("publish_time"), now)
    if status == "ok" and str(r.get("publish_time")) != iso:
        r["publish_time"] = iso
        flags["time_normalized"] = True
    elif status in ("future", "unparsable"):
        r["publish_time"] = None
        flags["time_dropped"] = True

    # 坏链清理：API 路径等非页面 URL 置空（避免前端点击进 API JSON）
    if r.get("detail_url") and not _is_valid_detail_url(r.get("detail_url")):
        r["detail_url"] = None
        flags["bad_url_dropped"] = True

    if not r.get("detail_url"):
        url = build_detail_url(r.get("company", ""), str(r.get("job_id") or ""), prefix_map)
        if url:
            r["detail_url"] = url
            flags["url_filled"] = True

    return r, flags


def _is_stale(record: dict[str, Any], now: datetime, stale_days: int, past_years: tuple[int, ...]) -> str | None:
    """过期判定：返回原因（past_batch / old_publish）或 None。

    - past_batch：标题明示往届批次（如「2026届校招」，当前为 2027 届秋招）
    - old_publish：发布时间早于 now - stale_days
    """
    title = str(record.get("title") or "")
    if any(f"{y}届" in title for y in past_years):
        return "past_batch"
    v = record.get("publish_time")
    if v:
        try:
            dt = datetime.strptime(str(v), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            if (now - dt).days > stale_days:
                return "old_publish"
        except ValueError:
            pass
    return None


def run(
    input_path: str,
    output_path: str | None,
    in_place: bool,
    *,
    drop_stale: bool = False,
    stale_days: int = 365,
    past_years: tuple[int, ...] = (2024, 2025, 2026),
) -> dict[str, Any]:
    src = Path(input_path)
    prefix_map = _load_feishu_prefix_map()
    now = datetime.now(timezone.utc)

    stats = Counter()
    by_company_url = defaultdict(lambda: [0, 0])
    out_records: list[dict[str, Any]] = []

    with src.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            raw = json.loads(line)
            rec, flags = enrich_record(raw, prefix_map, now)
            stats["total"] += 1

            if drop_stale:
                reason = _is_stale(rec, now, stale_days, past_years)
                if reason:
                    stats["dropped_stale"] += 1
                    stats[f"dropped_{reason}"] += 1
                    stats[f"dropped_by_company:{rec.get('company','?')}"] += 1
                    continue

            if flags["time_normalized"]:
                stats["time_normalized"] += 1
            if flags["time_dropped"]:
                stats["time_dropped"] += 1
            if flags["url_filled"]:
                stats["url_filled"] += 1
            if flags["bad_url_dropped"]:
                stats["bad_url_dropped"] += 1
            if flags["city_normalized"]:
                stats["city_normalized"] += 1
            c = rec.get("company", "")
            by_company_url[c][0] += 1
            if rec.get("detail_url"):
                by_company_url[c][1] += 1
            out_records.append(rec)

    dst = src if in_place else Path(output_path or src.with_suffix(".enriched.jsonl"))
    if in_place:
        tmp = src.with_suffix(src.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            for r in out_records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        tmp.replace(src)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with dst.open("w", encoding="utf-8") as f:
            for r in out_records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # 无详情链接的企业报告
    missing_url = {
        c: f"{t - w}/{t}"
        for c, (t, w) in sorted(by_company_url.items(), key=lambda x: x[1][1] - x[1][0])
        if w < t
    }

    dropped_detail = {
        k.replace("dropped_by_company:", ""): v
        for k, v in stats.items()
        if k.startswith("dropped_by_company:")
    }
    return {
        "total": stats["total"],
        "dropped_stale": stats["dropped_stale"],
        "dropped_past_batch": stats["dropped_past_batch"],
        "dropped_old_publish": stats["dropped_old_publish"],
        "dropped_by_company": dropped_detail,
        "kept": len(out_records),
        "time_normalized": stats["time_normalized"],
        "time_dropped": stats["time_dropped"],
        "url_filled": stats["url_filled"],
        "bad_url_dropped": stats["bad_url_dropped"],
        "city_normalized": stats["city_normalized"],
        "output": str(dst),
        "missing_url_companies": missing_url,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Enrich jobs JSONL: time normalize + detail_url fill")
    p.add_argument("--input", required=True)
    p.add_argument("--output")
    p.add_argument("--in-place", action="store_true")
    p.add_argument("--drop-stale", action="store_true",
                   help="删除过期数据（往届批次标题 + 发布超 stale-days）")
    p.add_argument("--stale-days", type=int, default=365, help="发布时间超期天数阈值（默认 365）")
    p.add_argument("--past-batch-years", default="2024,2025,2026",
                   help="视为往届批次的年份，逗号分隔（默认 2024,2025,2026）")
    args = p.parse_args()

    past_years = tuple(int(y) for y in args.past_batch_years.split(",") if y.strip())
    res = run(args.input, args.output, args.in_place,
              drop_stale=args.drop_stale, stale_days=args.stale_days, past_years=past_years)
    print(f"[enrich] 总记录: {res['total']}")
    print(f"[enrich] 时间归一化: {res['time_normalized']}")
    print(f"[enrich] 时间异常置空: {res['time_dropped']}")
    print(f"[enrich] 补全详情链接: {res['url_filled']}")
    print(f"[enrich] 坏链清理: {res['bad_url_dropped']}")
    print(f"[enrich] 城市归一化: {res['city_normalized']}")
    if res.get("dropped_stale"):
        print(f"[enrich] 删除过期: {res['dropped_stale']}（往届批次 {res['dropped_past_batch']} + 发布超{args.stale_days}天 {res['dropped_old_publish']}）")
        print(f"[enrich] 保留: {res['kept']}")
        by_c = sorted(res["dropped_by_company"].items(), key=lambda x: -x[1])[:8]
        print(f"[enrich] 删除企业分布: {dict(by_c)}")
    print(f"[enrich] 输出: {res['output']}")
    if res["missing_url_companies"]:
        print("\n仍缺详情链接的企业:")
        for c, ratio in res["missing_url_companies"].items():
            reason = NO_DETAIL_REASON.get(c, "")
            print(f"  {c}: {ratio}" + (f"  ({reason})" if reason else ""))


if __name__ == "__main__":
    main()
