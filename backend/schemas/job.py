from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, field_validator


def _parse_datetime(v):
    """Parse datetime from string, return None for invalid dates."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        if not v or v in ('0000-00-00 00:00:00', '1970-01-01 00:00:00', ''):
            return None
        try:
            return datetime.strptime(v, '%Y-%m-%d %H:%M:%S')
        except Exception:
            return None
    return v


class JobSummary(BaseModel):
    id: int
    job_id: str
    company: Optional[str]
    title: Optional[str]
    recruit_type: Optional[str]
    job_category: Optional[str]
    work_city: Optional[str]
    publish_time: Optional[datetime]
    detail_url: Optional[str]

    @field_validator('publish_time', mode='before')
    @classmethod
    def normalize_publish_time(cls, v):
        return _parse_datetime(v)

    model_config = {"from_attributes": True}


def _normalize_list(v: Union[list, str, None]) -> Optional[list]:
    if v is None:
        return None
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        if not v or v == 'null':
            return None
        # Try to parse as JSON
        import json as _json
        try:
            return _json.loads(v)
        except Exception:
            # If it's a single city string, wrap in list
            return [v] if v else None
    return None


class JobDetail(BaseModel):
    id: int
    job_id: str
    company: Optional[str]
    title: Optional[str]
    recruit_type: Optional[str]
    job_category: Optional[str]
    job_function: Optional[str]
    work_city: Optional[str]
    work_cities: Optional[list] = None
    team_intro: Optional[str]
    responsibilities: Optional[str]
    requirements: Optional[str]
    bonus_points: Optional[str]
    tags: Optional[list] = None
    publish_time: Optional[datetime]
    detail_url: Optional[str]
    fetched_at: Optional[datetime]

    @field_validator('work_cities', mode='before')
    @classmethod
    def normalize_work_cities(cls, v):
        return _normalize_list(v)

    @field_validator('tags', mode='before')
    @classmethod
    def normalize_tags(cls, v):
        return _normalize_list(v)

    @field_validator('publish_time', mode='before')
    @classmethod
    def normalize_publish_time(cls, v):
        return _parse_datetime(v)

    @field_validator('fetched_at', mode='before')
    @classmethod
    def normalize_fetched_at(cls, v):
        return _parse_datetime(v)

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[JobSummary]


class FiltersResponse(BaseModel):
    cities: list[str]
    recruit_types: list[str]
    job_categories: list[str]
    companies: list[str] = []


class DynamicFiltersResponse(BaseModel):
    cities: list[str]
    recruit_types: list[str]
    job_categories: list[str]
    companies: list[str]
