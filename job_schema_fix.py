from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator

def _parse_datetime(v):
    if v is None: return None
    if isinstance(v, datetime): return v
    if isinstance(v, str):
        if not v or v in ("0000-00-00 00:00:00", "1970-01-01 00:00:00", ""): return None
        try: return datetime.strptime(v, "%Y-%m-%d %H:%M:%S")
        except: return None
    return v

class JobSummary(BaseModel):
    id: int; job_id: str
    company: Optional[str]; title: Optional[str]
    recruit_type: Optional[str]; job_category: Optional[str]
    work_city: Optional[str]; publish_time: Optional[datetime]
    detail_url: Optional[str]
    @field_validator("publish_time", mode="before")
    @classmethod
    def normalize_publish_time(cls, v): return _parse_datetime(v)
    model_config = {"from_attributes": True}

def _normalize_list(v):
    if v is None: return None
    if isinstance(v, list): return v
    if isinstance(v, str):
        if not v or v == "null": return None
        import json
        try: return json.loads(v)
        except: return [v] if v else None
    return None

class JobDetail(BaseModel):
    id: int; job_id: str; company: Optional[str]; title: Optional[str]
    recruit_type: Optional[str]; job_category: Optional[str]
    job_function: Optional[str]; work_city: Optional[str]
    work_cities: Optional[list] = None; team_intro: Optional[str]
    responsibilities: Optional[str]; requirements: Optional[str]
    bonus_points: Optional[str]; tags: Optional[list] = None
    publish_time: Optional[datetime] = None; detail_url: Optional[str]
    fetched_at: Optional[datetime] = None
    @field_validator("work_cities", "tags", mode="before")
    @classmethod
    def normalize_lists(cls, v): return _normalize_list(v)
    @field_validator("publish_time", "fetched_at", mode="before")
    @classmethod
    def normalize_dt(cls, v): return _parse_datetime(v)
    model_config = {"from_attributes": True}

class JobListResponse(BaseModel):
    total: int; page: int; page_size: int; items: list

class FiltersResponse(BaseModel):
    cities: list; recruit_types: list; job_categories: list; companies: list = []

class DynamicFiltersResponse(BaseModel):
    cities: list; recruit_types: list; job_categories: list; companies: list
