from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from services.job_service import list_jobs, get_job, get_filters, get_dynamic_filters
from schemas.job import JobListResponse, JobDetail, FiltersResponse, DynamicFiltersResponse

router = APIRouter()


@router.get("", response_model=JobListResponse)
async def get_jobs(
    q: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    recruit_type: Optional[str] = Query(None),
    job_category: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    sort: str = Query("latest", pattern="^(latest|relevance)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await list_jobs(db, q=q, city=city, recruit_type=recruit_type,
                           job_category=job_category, company=company,
                           sort=sort, page=page, page_size=page_size)


@router.get("/meta/filters", response_model=FiltersResponse)
async def filters_meta(db: AsyncSession = Depends(get_db)):
    return await get_filters(db)


@router.get("/meta/dynamic-filters", response_model=DynamicFiltersResponse)
async def dynamic_filters_meta(
    q: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    recruit_type: Optional[str] = Query(None),
    job_category: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await get_dynamic_filters(db, q=q, city=city, recruit_type=recruit_type,
                                     job_category=job_category, company=company)


@router.get("/{job_id}", response_model=JobDetail)
async def job_detail(job_id: int, db: AsyncSession = Depends(get_db)):
    return await get_job(db, job_id)
