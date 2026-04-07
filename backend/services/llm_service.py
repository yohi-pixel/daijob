import json
import re
from openai import AsyncOpenAI
from fastapi import HTTPException
from config import settings

OPTIMIZE_PROMPT_TEMPLATE = (
    "你是一位专业的简历优化顾问，擅长为中国互联网大厂校招/实习生优化简历。\n\n"
    "目标职位：\n"
    "- 公司：{company}\n"
    "- 职位：{title}\n"
    "- 职责要求：{responsibilities}\n"
    "- 岗位要求：{requirements}\n"
    "- 加分项：{bonus_points}\n\n"
    "原始简历：\n{resume_text}\n\n"
    "请根据该职位的要求，对简历进行优化重写。要求：\n"
    "1. 保留真实信息，不虚构经历\n"
    "2. 用 STAR 法则重写项目/实习经历\n"
    "3. 突出与该职位相关的技能和经验\n"
    "4. 添加量化指标（如有可能）\n"
    "5. 使用简洁专业的语言\n"
    "6. 输出格式为 Markdown\n\n"
    '请输出优化后的简历内容，并在最后附上 3-5 条优化说明（以 JSON 数组格式输出，key 为 "suggestions"）。'
)


def _extract_suggestions(text: str) -> tuple[str, list[str]]:
    pattern = r'\{"suggestions"\s*:\s*(\[.*?\])\s*\}'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            suggestions = json.loads(match.group(1))
            resume_part = text[:match.start()].strip()
            return resume_part, suggestions
        except json.JSONDecodeError:
            pass
    return text.strip(), []


async def _call_llm(client: AsyncOpenAI, model: str, prompt: str) -> str:
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return response.choices[0].message.content or ""


async def optimize_resume(
    resume_text: str,
    company: str,
    title: str,
    responsibilities: str,
    requirements: str,
    bonus_points: str,
) -> tuple[str, list[str]]:
    prompt = OPTIMIZE_PROMPT_TEMPLATE.format(
        company=company,
        title=title,
        responsibilities=responsibilities,
        requirements=requirements,
        bonus_points=bonus_points,
        resume_text=resume_text,
    )
    if settings.DEEPSEEK_API_KEY:
        try:
            client = AsyncOpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url=settings.DEEPSEEK_BASE_URL,
            )
            text = await _call_llm(client, "deepseek-chat", prompt)
            return _extract_suggestions(text)
        except Exception:
            pass
    if settings.QWEN_API_KEY:
        try:
            client = AsyncOpenAI(
                api_key=settings.QWEN_API_KEY,
                base_url=settings.QWEN_BASE_URL,
            )
            text = await _call_llm(client, settings.QWEN_MODEL, prompt)
            return _extract_suggestions(text)
        except Exception:
            pass
    raise HTTPException(status_code=503, detail="AI service unavailable")
