from typing import Any, Optional
from pydantic import BaseModel


class ExperienceModule(BaseModel):
    module_type: str
    data: dict[str, Any]


class ParsedResume(BaseModel):
    basic_info: Optional[dict[str, Any]] = None
    experiences: list[ExperienceModule] = []
    skill: Optional[dict[str, Any]] = None
    summary: Optional[dict[str, Any]] = None
