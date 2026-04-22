import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from services.search_utils import normalize_city_values, normalize_job_category
except ModuleNotFoundError:
    sys.path.append(str(Path(__file__).resolve().parents[1]))
    from services.search_utils import normalize_city_values, normalize_job_category


def _parse_timestamp(value: Any) -> float:
    if value is None:
        return float("-inf")

    text = str(value).strip()
    if not text:
        return float("-inf")

    if text.isdigit():
        if len(text) >= 13:
            return int(text) / 1000.0
        if len(text) >= 10:
            return float(int(text))

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()
    except ValueError:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).timestamp()
        except ValueError:
            continue

    return float("-inf")


def _is_better_record(candidate: dict[str, Any], existing: dict[str, Any]) -> bool:
    candidate_publish = _parse_timestamp(candidate.get("publish_time"))
    existing_publish = _parse_timestamp(existing.get("publish_time"))
    if candidate_publish != existing_publish:
        return candidate_publish > existing_publish

    candidate_fetched = _parse_timestamp(candidate.get("fetched_at"))
    existing_fetched = _parse_timestamp(existing.get("fetched_at"))
    if candidate_fetched != existing_fetched:
        return candidate_fetched > existing_fetched

    return False


def _dedupe_key(record: dict[str, Any]) -> str:
    job_id = str(record.get("job_id") or "").strip()
    if job_id:
        return f"job_id:{job_id}"

    detail_url = str(record.get("detail_url") or "").strip()
    if detail_url:
        return f"detail_url:{detail_url}"

    company = str(record.get("company") or "").strip()
    title = str(record.get("title") or "").strip()
    publish_time = str(record.get("publish_time") or "").strip()
    return f"fallback:{company}|{title}|{publish_time}"


def clean_record(record: dict[str, Any]) -> tuple[dict[str, Any], dict[str, bool]]:
    cleaned = dict(record)

    old_city = cleaned.get("work_city")
    old_cities = cleaned.get("work_cities")
    normalized_cities = normalize_city_values(old_city, old_cities)
    cleaned["work_city"] = normalized_cities[0] if normalized_cities else None
    cleaned["work_cities"] = normalized_cities

    old_category = cleaned.get("job_category")
    cleaned["job_category"] = normalize_job_category(old_category)

    return cleaned, {
        "city_changed": old_city != cleaned["work_city"] or old_cities != cleaned["work_cities"],
        "category_changed": old_category != cleaned["job_category"],
    }


def clean_jsonl_file(
    input_path: str | Path,
    output_path: str | Path | None = None,
    *,
    deduplicate: bool = True,
    in_place: bool = False,
) -> dict[str, int]:
    src = Path(input_path)
    if not src.exists():
        raise FileNotFoundError(f"Input file not found: {src}")

    if in_place and output_path is not None:
        raise ValueError("output_path should not be set when in_place=True")

    if in_place:
        dst = src.with_suffix(src.suffix + ".tmp")
    elif output_path is not None:
        dst = Path(output_path)
    else:
        dst = src.with_suffix(".cleaned.jsonl")

    total_in = 0
    parse_failed = 0
    city_changed = 0
    category_changed = 0
    deduplicated = 0

    cleaned_records: list[dict[str, Any]] = []
    unique_map: dict[str, dict[str, Any]] = {}
    order: list[str] = []

    with src.open("r", encoding="utf-8") as f:
        for line in f:
            text = line.strip()
            if not text:
                continue
            total_in += 1
            try:
                raw = json.loads(text)
            except json.JSONDecodeError:
                parse_failed += 1
                continue

            cleaned, flags = clean_record(raw)
            if flags["city_changed"]:
                city_changed += 1
            if flags["category_changed"]:
                category_changed += 1

            if not deduplicate:
                cleaned_records.append(cleaned)
                continue

            key = _dedupe_key(cleaned)
            existing = unique_map.get(key)
            if existing is None:
                unique_map[key] = cleaned
                order.append(key)
            else:
                deduplicated += 1
                if _is_better_record(cleaned, existing):
                    unique_map[key] = cleaned

    if deduplicate:
        cleaned_records = [unique_map[k] for k in order]

    dst.parent.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8") as f:
        for item in cleaned_records:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    if in_place:
        dst.replace(src)

    return {
        "total_in": total_in,
        "parse_failed": parse_failed,
        "total_out": len(cleaned_records),
        "city_changed": city_changed,
        "category_changed": category_changed,
        "deduplicated": deduplicated,
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Clean and normalize jobs JSONL file")
    parser.add_argument("--input", required=True, help="Input jobs.jsonl path")
    parser.add_argument("--output", help="Output path (default: <input>.cleaned.jsonl)")
    parser.add_argument("--in-place", action="store_true", help="Overwrite input file")
    parser.add_argument("--no-dedupe", action="store_true", help="Disable deduplication")
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    summary = clean_jsonl_file(
        args.input,
        output_path=args.output,
        deduplicate=not args.no_dedupe,
        in_place=args.in_place,
    )
    print(
        "[clean_jobs_file] "
        f"in={summary['total_in']} out={summary['total_out']} parse_failed={summary['parse_failed']} "
        f"city_changed={summary['city_changed']} category_changed={summary['category_changed']} "
        f"deduplicated={summary['deduplicated']}"
    )


if __name__ == "__main__":
    main()
