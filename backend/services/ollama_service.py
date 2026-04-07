import httpx
from config import settings

MATCH_PROMPT_TEMPLATE = (
    "你是一个招聘助手。请评估以下简历与职位的匹配程度，返回 0-100 的整数分数。\n\n"
    "职位信息：\n"
    "- 职位名称：{title}\n"
    "- 职位类别：{job_category}\n"
    "- 职责：{responsibilities}\n"
    "- 要求：{requirements}\n\n"
    "求职者简历：\n{resume_text}\n\n"
    "请只返回一个 0-100 的整数，不要有任何其他文字。"
)


def build_match_prompt(resume_text: str, job) -> str:
    return MATCH_PROMPT_TEMPLATE.format(
        title=job.title or "",
        job_category=job.job_category or "",
        responsibilities=job.responsibilities or "",
        requirements=job.requirements or "",
        resume_text=resume_text,
    )


async def score_single(resume_text: str, job) -> int | None:
    prompt = build_match_prompt(resume_text, job)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                },
            )
            if response.status_code != 200:
                return None
            data = response.json()
            text = data.get("response", "").strip()
            score = int(text)
            if 0 <= score <= 100:
                return score
            return None
    except Exception:
        return None


async def batch_match(resume_text: str, jobs: list) -> dict[int, int | None]:
    import asyncio
    tasks = [score_single(resume_text, job) for job in jobs]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    scores = {}
    for job, result in zip(jobs, results):
        if isinstance(result, Exception):
            scores[job.id] = None
        else:
            scores[job.id] = result
    return scores
