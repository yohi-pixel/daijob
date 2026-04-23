import json
from typing import AsyncGenerator, Any
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from config import settings
from models.user_profile import UserProfile

SYSTEM_PROMPT = """你是一位专业的求职顾问小助手，名叫"小逮"。你的任务是通过自然对话，帮助用户梳理求职信息，构建完整的用户画像。

你需要收集的信息（按优先级）：
1. 基本信息：姓名、学历、专业、毕业时间
2. 求职意向：目标岗位、目标城市、求职类型（校招/实习/社招）
3. 技能栈：编程语言、框架、工具、证书
4. 经历：实习经历、项目经历、科研经历、获奖情况

对话原则：
- 每次只问 1-2 个问题，不要一次性问太多
- 根据用户回答自然地追问细节
- 不要编造或假设用户没有提到的信息
- 当信息足够完整时，主动说"我已经了解你的情况了，马上为你推荐合适的岗位！"
- 语气友好、简洁，像朋友聊天一样

**重要**：当你认为已收集到足够信息（至少包含：目标岗位、技能栈、至少一段经历），必须在回复的最后一行单独添加标记：[PROFILE_READY]
不要在标记前后添加任何其他文字，标记必须单独成行。"""

EXTRACT_PROMPT = """根据以下对话历史，提取用户的求职画像信息，以 JSON 格式输出。只提取对话中明确提到的信息，不要编造。

对话历史：
{history}

请输出以下格式的 JSON（没有的字段留空字符串或空数组）：
{{
  "name": "",
  "education": [{{"school": "", "degree": "", "major": "", "graduation": ""}}],
  "experiences": [{{"type": "internship/project/research/award", "org": "", "role": "", "period": "", "description": ""}}],
  "skills": [],
  "target_role": "",
  "target_city": "",
  "recruit_type": "校招/实习/社招"
}}

只输出 JSON，不要任何解释。"""


async def _get_or_create_profile(user_id: int, db: AsyncSession) -> tuple[UserProfile, dict]:
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile_row = result.scalar_one_or_none()
    if profile_row is None:
        profile_row = UserProfile(user_id=user_id, profile_json="{}")
        db.add(profile_row)
        await db.flush()
    try:
        data = json.loads(profile_row.profile_json)
    except Exception:
        data = {}
    return profile_row, data


async def _save_profile(profile_row: UserProfile, data: dict, db: AsyncSession):
    profile_row.profile_json = json.dumps(data, ensure_ascii=False)
    await db.commit()


def _build_messages(history: list[dict], user_message: str, context: str = "") -> list[dict]:
    system_content = SYSTEM_PROMPT
    if context:
        system_content += f"\n\n用户已有简历信息（勿重复询问已知信息）：\n{context}"
    messages = [{"role": "system", "content": system_content}]
    for turn in history[-20:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


def _get_llm_client() -> tuple[Any, str] | None:
    if settings.DEEPSEEK_API_KEY:
        return AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL), "deepseek-chat"
    if settings.QWEN_API_KEY:
        return AsyncOpenAI(api_key=settings.QWEN_API_KEY, base_url=settings.QWEN_BASE_URL), settings.QWEN_MODEL
    return None


async def chat_stream(user_id: int, message: str, db: AsyncSession, context: str = "") -> AsyncGenerator[str, None]:
    profile_row, data = await _get_or_create_profile(user_id, db)
    history: list[dict] = data.get("conversation_history", [])

    llm = _get_llm_client()
    if llm is None:
        yield 'data: {"content": "AI 服务未配置，请联系管理员。"}\n\n'
        yield "data: [DONE]\n\n"
        return

    client, model = llm
    messages = _build_messages(history, message, context)

    full_response = ""
    profile_ready = False
    try:
        stream = await client.chat.completions.create(
            model=model, messages=messages, stream=True, temperature=0.7, max_tokens=800,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                full_response += delta
                # Strip the marker before sending to client
                clean = delta.replace("[PROFILE_READY]", "")
                if clean:
                    yield f'data: {json.dumps({"content": clean}, ensure_ascii=False)}\n\n'
        if "[PROFILE_READY]" in full_response:
            profile_ready = True
            yield f'data: {json.dumps({"profile_ready": True}, ensure_ascii=False)}\n\n'
    except Exception as e:
        yield f'data: {json.dumps({"content": f"出错了：{str(e)[:100]}"}, ensure_ascii=False)}\n\n'
        yield "data: [DONE]\n\n"
        return

    yield "data: [DONE]\n\n"

    # Update conversation history
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": full_response.replace("[PROFILE_READY]", "").strip()})
    data["conversation_history"] = history[-20:]

    # Async profile extraction when ready
    if profile_ready or len(history) >= 6:
        try:
            history_text = "\n".join(f"{t['role']}: {t['content']}" for t in history[-10:])
            extract_client, extract_model = _get_llm_client()
            resp = await extract_client.chat.completions.create(
                model=extract_model,
                messages=[{"role": "user", "content": EXTRACT_PROMPT.format(history=history_text)}],
                temperature=0.1, max_tokens=600,
            )
            raw = resp.choices[0].message.content or ""
            # Strip markdown code fences if present
            raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            extracted = json.loads(raw)
            for k, v in extracted.items():
                if v:
                    data[k] = v
        except Exception:
            pass

    await _save_profile(profile_row, data, db)


async def get_profile(user_id: int, db: AsyncSession) -> dict:
    _, data = await _get_or_create_profile(user_id, db)
    return data


ANALYZE_JOB_FIT_PROMPT = """你是一位专业的求职顾问。根据用户的求职画像和目标岗位信息，给出具体的简历优化建议。

用户画像：
{profile}

目标岗位：
公司：{company}
职位：{title}
职责：{responsibilities}
要求：{requirements}
加分项：{bonus_points}

请从以下角度给出简洁、可操作的建议（每条建议不超过2句话）：
1. 技能匹配度分析（用户技能与岗位要求的匹配情况）
2. 经历亮点建议（哪些经历应该重点突出）
3. 简历优化要点（3-5条具体建议）

语气友好，直接给出建议，不要废话。"""


async def analyze_job_fit_stream(user_id: int, job, db: AsyncSession):
    profile = await get_profile(user_id, db)
    llm = _get_llm_client()
    if llm is None:
        yield 'data: {"content": "AI 服务未配置，请联系管理员。"}\n\n'
        yield "data: [DONE]\n\n"
        return

    profile_summary = []
    if profile.get("target_role"):
        profile_summary.append(f"目标岗位：{profile['target_role']}")
    if profile.get("skills"):
        profile_summary.append(f"技能：{', '.join(profile['skills'][:15])}")
    for exp in (profile.get("experiences") or [])[:3]:
        if exp.get("description"):
            profile_summary.append(f"经历：{exp.get('org', '')} {exp.get('role', '')} - {exp['description'][:100]}")
    if not profile_summary:
        yield 'data: {"content": "请先和我聊聊你的求职情况，这样我才能给出针对性建议哦～"}\n\n'
        yield "data: [DONE]\n\n"
        return

    prompt = ANALYZE_JOB_FIT_PROMPT.format(
        profile="\n".join(profile_summary),
        company=job.company or "",
        title=job.title or "",
        responsibilities=(job.responsibilities or "")[:300],
        requirements=(job.requirements or "")[:300],
        bonus_points=(job.bonus_points or "")[:200],
    )

    client, model = llm
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=True, temperature=0.5, max_tokens=600,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield f'data: {json.dumps({"content": delta}, ensure_ascii=False)}\n\n'
    except Exception as e:
        yield f'data: {json.dumps({"content": f"分析出错：{str(e)[:80]}"}, ensure_ascii=False)}\n\n'
    yield "data: [DONE]\n\n"


def build_profile_query(profile: dict) -> str:
    parts = []
    if profile.get("target_role"):
        parts.append(profile["target_role"])
    if profile.get("skills"):
        parts.append(" ".join(profile["skills"][:10]))
    for exp in (profile.get("experiences") or [])[:3]:
        if exp.get("description"):
            parts.append(exp["description"][:100])
    return " ".join(parts)


EXTRACT_RESUME_PROMPT = """根据以下对话历史，提取用户提到的简历模块信息，以 JSON 数组格式输出。只提取对话中明确提到的信息，不要编造。

对话历史：
{history}

请输出以下格式的 JSON 数组（每个模块一个对象）：
[
  {{"type": "basic", "data": {{"name": "", "phone": "", "email": "", "location": ""}}}},
  {{"type": "education", "data": {{"school": "", "degree": "", "major": "", "graduation": ""}}}},
  {{"type": "experience", "data": {{"company": "", "position": "", "period": "", "description": ""}}}},
  {{"type": "project", "data": {{"name": "", "role": "", "period": "", "description": "", "tech": ""}}}},
  {{"type": "skill", "data": {{"category": "", "items": []}}}}
]

只输出 JSON 数组，不要任何解释。如果没有提取到任何模块，输出空数组 []。"""


async def extract_resume_modules(user_id: int, db: AsyncSession) -> list[dict]:
    profile_row, data = await _get_or_create_profile(user_id, db)
    history: list[dict] = data.get("conversation_history", [])
    if not history:
        return []

    llm = _get_llm_client()
    if llm is None:
        return []

    try:
        history_text = "\n".join(f"{t['role']}: {t['content']}" for t in history[-20:])
        client, model = llm
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": EXTRACT_RESUME_PROMPT.format(history=history_text)}],
            temperature=0.1, max_tokens=1000,
        )
        raw = resp.choices[0].message.content or ""
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        modules = json.loads(raw)
        return modules if isinstance(modules, list) else []
    except Exception:
        return []
