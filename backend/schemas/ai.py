from typing import Optional
from pydantic import BaseModel


class MatchRequest(BaseModel):
    resume_text: str
    job_ids: list[int]


class MatchResponse(BaseModel):
    scores: dict[str, Optional[int]]


class OptimizeRequest(BaseModel):
    resume_text: str
    job_id: int


class OptimizeResponse(BaseModel):
    optimized_resume: str
    suggestions: list[str]
