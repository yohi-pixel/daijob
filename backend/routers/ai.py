from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models.job import Job
from schemas.ai import MatchRequest, MatchResponse
from services.auth_service import get_current_user
from services.ollama_service import batch_match

router = APIRouter()


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
