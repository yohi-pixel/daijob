from typing import Optional
from sqlalchemy import select, func, distinct, case
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from models.job import Job
from schemas.job import JobListResponse, JobDetail, FiltersResponse, JobSummary, DynamicFiltersResponse


async def list_jobs(
    db: AsyncSession,
    q: Optional[str] = None,
    city: Optional[str] = None,
    recruit_type: Optional[str] = None,
    job_category: Optional[str] = None,
    company: Optional[str] = None,
    sort: str = "latest",
    page: int = 1,
    page_size: int = 20,
) -> JobListResponse:
    page_size = min(page_size, 100)
    stmt = select(Job)
    if q:
        stmt = stmt.where(Job.title.ilike(f"%{q}%"))
    if city:
        stmt = stmt.where(Job.work_city == city)
    if recruit_type:
        stmt = stmt.where(Job.recruit_type == recruit_type)
    if job_category:
        stmt = stmt.where(Job.job_category == job_category)
    if company:
        stmt = stmt.where(Job.company.ilike(f"%{company}%"))
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    if sort == "latest":
        # MySQL compatible: put NULL values last
        stmt = stmt.order_by(
            case((Job.publish_time.isnot(None), 0), else_=1),
            Job.publish_time.desc()
        )
    else:
        stmt = stmt.order_by(Job.id.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return JobListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[JobSummary.model_validate(j) for j in jobs],
    )


async def get_job(db: AsyncSession, job_id: int) -> JobDetail:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobDetail.model_validate(job)


async def get_filters(db: AsyncSession) -> FiltersResponse:
    cities_result = await db.execute(
        select(distinct(Job.work_city)).where(Job.work_city.isnot(None)).order_by(Job.work_city)
    )
    cities = [r[0] for r in cities_result.fetchall() if r[0]]
    types_result = await db.execute(
        select(distinct(Job.recruit_type)).where(Job.recruit_type.isnot(None)).order_by(Job.recruit_type)
    )
    recruit_types = [r[0] for r in types_result.fetchall() if r[0]]
    cats_result = await db.execute(
        select(distinct(Job.job_category)).where(Job.job_category.isnot(None)).order_by(Job.job_category)
    )
    job_categories = [r[0] for r in cats_result.fetchall() if r[0]]
    companies_result = await db.execute(
        select(distinct(Job.company)).where(Job.company.isnot(None)).order_by(Job.company)
    )
    companies = [r[0] for r in companies_result.fetchall() if r[0]]
    return FiltersResponse(cities=cities, recruit_types=recruit_types, job_categories=job_categories, companies=companies)


PRIORITY_CITIES = ["广州", "北京", "上海", "深圳", "杭州"]


def _sort_cities(cities: list[str]) -> list[str]:
    priority = [c for c in PRIORITY_CITIES if c in cities]
    rest = sorted(c for c in cities if c not in PRIORITY_CITIES)
    return priority + rest


async def get_dynamic_filters(
    db: AsyncSession,
    q: Optional[str] = None,
    city: Optional[str] = None,
    recruit_type: Optional[str] = None,
    job_category: Optional[str] = None,
    company: Optional[str] = None,
) -> DynamicFiltersResponse:
    def base(skip_city=False, skip_type=False, skip_cat=False, skip_company=False):
        s = select(Job)
        if q:
            s = s.where(Job.title.ilike(f"%{q}%"))
        if city and not skip_city:
            s = s.where(Job.work_city == city)
        if recruit_type and not skip_type:
            s = s.where(Job.recruit_type == recruit_type)
        if job_category and not skip_cat:
            s = s.where(Job.job_category == job_category)
        if company and not skip_company:
            s = s.where(Job.company == company)
        return s

    async def fetch(col, **skip_flags):
        sub = base(**skip_flags).subquery()
        r = await db.execute(
            select(distinct(sub.c[col.key])).where(sub.c[col.key].isnot(None)).order_by(sub.c[col.key])
        )
        return [row[0] for row in r.fetchall() if row[0]]

    cities_raw = await fetch(Job.work_city, skip_city=True)
    recruit_types = await fetch(Job.recruit_type, skip_type=True)
    job_categories = await fetch(Job.job_category, skip_cat=True)
    companies = await fetch(Job.company, skip_company=True)

    return DynamicFiltersResponse(
        cities=_sort_cities(cities_raw),
        recruit_types=recruit_types,
        job_categories=job_categories,
        companies=companies,
    )
