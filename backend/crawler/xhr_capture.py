"""Playwright XHR 抓包工具（F5 逆向用）

用法：
  python xhr_capture.py <url> [--wait 秒] [--filter 关键字]
  python xhr_capture.py "https://jobs.bytedance.com/campus/position" --wait 8 --filter position

抓取页面加载期间所有 XHR/fetch 请求的 method、url、请求体、响应前 500 字符，
输出到 stdout 与 /tmp/xhr_capture_{ts}.jsonl。
"""
from __future__ import annotations

import argparse
import json
import sys
import time

from playwright.sync_api import sync_playwright


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--wait", type=int, default=8, help="加载后等待秒数")
    p.add_argument("--filter", default="", help="只显示含该关键字的请求")
    p.add_argument("--scroll", action="store_true", help="滚动页面触发懒加载")
    args = p.parse_args()

    captured: list[dict] = []
    out_path = f"/tmp/xhr_capture_{int(time.time())}.jsonl"

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900},
        )
        page = ctx.new_page()

        def on_response(resp):
            url = resp.url
            ct = resp.headers.get("content-type", "")
            if "json" not in ct and "javascript" not in ct:
                return
            req = resp.request
            entry = {
                "method": req.method,
                "url": url[:300],
                "req_body": None,
                "resp_len": None,
                "resp_head": None,
            }
            try:
                body = req.post_data
                if body:
                    entry["req_body"] = body[:500]
            except Exception:
                pass
            try:
                text = resp.text()
                entry["resp_len"] = len(text)
                entry["resp_head"] = text[:500]
            except Exception:
                pass
            captured.append(entry)
            if not args.filter or args.filter in url:
                print(json.dumps(entry, ensure_ascii=False)[:600])

        page.on("response", on_response)
        print(f"# 打开 {args.url} ...", file=sys.stderr)
        try:
            page.goto(args.url, wait_until="domcontentloaded", timeout=30000)
            if args.scroll:
                for _ in range(5):
                    page.mouse.wheel(0, 1500)
                    page.wait_for_timeout(800)
            page.wait_for_timeout(args.wait * 1000)
        except Exception as e:
            print(f"# 页面加载异常: {e}", file=sys.stderr)
        browser.close()

    with open(out_path, "w", encoding="utf-8") as f:
        for e in captured:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    print(f"\n# 共捕获 {len(captured)} 个请求 → {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
