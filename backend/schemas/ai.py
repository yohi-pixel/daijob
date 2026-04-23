from typing import Any, Optional
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


class OptimizeModuleRequest(BaseModel):
    module_type: str
    module_data: dict[str, Any]
    job_id: Optional[int] = None


class ChatRequest(BaseModel):
    message: str
    session_id: str = ""
    context: str = ""


class RecommendRequest(BaseModel):
    top_k: int = 10


class AnalyzeJobFitRequest(BaseModel):
    job_id: int


class InviteCodeRequest(BaseModel):
    code: str


class ExtractResumeRequest(BaseModel):
    pass


class ExtractResumeResponse(BaseModel):
    modules: list[dict[str, Any]]
