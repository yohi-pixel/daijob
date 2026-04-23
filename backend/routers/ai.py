from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models.job import Job
from models.user import User
from schemas.ai import MatchRequest, MatchResponse, OptimizeRequest, OptimizeResponse, OptimizeModuleRequest, ChatRequest, RecommendRequest, AnalyzeJobFitRequest, InviteCodeRequest, ExtractResumeRequest, ExtractResumeResponse
from services.auth_service import get_current_user
from services.ollama_service import batch_match
from services.llm_service import optimize_resume, optimize_module_stream
from services.chat_service import chat_stream, get_profile, build_profile_query, analyze_job_fit_stream, extract_resume_modules
from services.semantic_vector_service import semantic_vector_scores
from config import settings
from services.job_service import _to_job_summary

router = APIRouter()


async def check_ai_invite(user_id: int, db: AsyncSession):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.ai_invite_verified:
        raise HTTPException(status_code=403, detail="需要邀请码才能使用 AI 功能")


@router.post("/verify-invite")
async def verify_invite_endpoint(
    body: InviteCodeRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.code != settings.AI_INVITE_CODE:
        raise HTTPException(status_code=400, detail="邀请码错误")
    await db.execute(update(User).where(User.id == user_id).values(ai_invite_verified=True))
    await db.commit()
    return {"message": "验证成功"}


@router.post("/match", response_model=MatchResponse)
async def match_jobs(
    body: MatchRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.job_ids) > 50:
        raise HTTPException(status_code=400, detail="TOO_MANY_JOBS")
    if len(body.resume_text) > 5000:
        raise HTTPException(status_code=400, detail="RESUME_TOO_LONG")
    result = await db.execute(select(Job).where(Job.id.in_(body.job_ids)))
    jobs = result.scalars().all()
    scores = await batch_match(body.resume_text, jobs)
    return MatchResponse(scores={str(k): v for k, v in scores.items()})


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_resume_endpoint(
    body: OptimizeRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.resume_text) > 5000:
        raise HTTPException(status_code=400, detail="RESUME_TOO_LONG")
    result = await db.execute(select(Job).where(Job.id == body.job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    optimized, suggestions = await optimize_resume(
        body.resume_text,
        job.company or "",
        job.title or "",
        job.responsibilities or "",
        job.requirements or "",
        job.bonus_points or "",
    )
    return OptimizeResponse(optimized_resume=optimized, suggestions=suggestions)


@router.post("/optimize-module")
async def optimize_module_endpoint(
    body: OptimizeModuleRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = None
    if body.job_id is not None:
        result = await db.execute(select(Job).where(Job.id == body.job_id))
        job = result.scalar_one_or_none()

    return StreamingResponse(
        optimize_module_stream(body.module_type, body.module_data, job),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat")
async def chat_endpoint(
    body: ChatRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_ai_invite(user_id, db)
    return StreamingResponse(
        chat_stream(user_id, body.message, db, body.context),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/profile")
async def profile_endpoint(
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_profile(user_id, db)


@router.post("/recommend-jobs")
async def recommend_jobs_endpoint(
    body: RecommendRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_ai_invite(user_id, db)
    profile = await get_profile(user_id, db)
    query_text = build_profile_query(profile)
    if not query_text:
        raise HTTPException(status_code=400, detail="用户画像信息不足，请先与小助手对话")

    result = await db.execute(select(Job))
    all_jobs = result.scalars().all()
    if not all_jobs:
        return {"jobs": []}

    documents = []
    for job in all_jobs:
        doc = " ".join(filter(None, [job.title, job.responsibilities, job.requirements, job.bonus_points]))
        documents.append(doc[:500])

    scores = semantic_vector_scores(query_text, documents, settings.EMBEDDING_MODEL)
    if scores is None:
        raise HTTPException(status_code=503, detail="向量搜索服务不可用")

    ranked = sorted(zip(all_jobs, scores), key=lambda x: x[1], reverse=True)
    top_jobs = [_to_job_summary(job) for job, _ in ranked[:body.top_k]]
    return {"jobs": top_jobs}


@router.post("/analyze-job-fit")
async def analyze_job_fit_endpoint(
    body: AnalyzeJobFitRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_ai_invite(user_id, db)
    result = await db.execute(select(Job).where(Job.id == body.job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="岗位不存在")
    from services.chat_service import analyze_job_fit_stream
    return StreamingResponse(
        analyze_job_fit_stream(user_id, job, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/extract-resume", response_model=ExtractResumeResponse)
async def extract_resume_endpoint(
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_ai_invite(user_id, db)
    modules = await extract_resume_modules(user_id, db)
    return ExtractResumeResponse(modules=modules)

