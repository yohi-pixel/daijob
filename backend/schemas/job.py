from datetime import datetime
from typing import Optional
from pydantic import BaseModel


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

    model_config = {"from_attributes": True}


class JobDetail(BaseModel):
    id: int
    job_id: str
    company: Optional[str]
    title: Optional[str]
    recruit_type: Optional[str]
    job_category: Optional[str]
    job_function: Optional[str]
    work_city: Optional[str]
    work_cities: Optional[list]
    team_intro: Optional[str]
    responsibilities: Optional[str]
    requirements: Optional[str]
    bonus_points: Optional[str]
    tags: Optional[list]
    publish_time: Optional[datetime]
    detail_url: Optional[str]
    fetched_at: Optional[datetime]

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
