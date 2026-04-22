from datetime import datetime
from typing import Optional
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from models.job import Job
from schemas.job import JobListResponse, JobDetail, FiltersResponse, JobSummary, DynamicFiltersResponse
from services.search_utils import (
    bm25_scores,
    cosine_tfidf_scores,
    normalize_city_token,
    normalize_city_values,
    normalize_job_category,
    parse_signed_filter,
    rrf_merge,
    tokenize_text,
)
from services.semantic_vector_service import semantic_vector_scores
from config import settings


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

    # Build SQL WHERE conditions (city excluded — DB has encoding issues, filtered in Python)
    query = select(Job)
    query = _apply_filters(query, recruit_type=recruit_type,
                          job_category=job_category, company=company)

    result = await db.execute(query)
    jobs = result.scalars().all()

    # Apply city filter in Python (normalize_city_values handles garbled DB encoding)
    if city:
        city_values = [c.strip() for c in city.split(',') if c.strip()]
        if city_values:
            city_set = set(city_values)
            jobs = [j for j in jobs if city_set & set(_job_cities(j))]

    # Apply search ranking if query present
    if q and sort == "relevance":
        ordered = _rank_jobs_by_hybrid(q, jobs)
    elif sort == "latest":
        ordered = sorted(
            jobs,
            key=lambda job: (job.publish_time is not None, job.publish_time or datetime.min),
            reverse=True,
        )
    else:
        ordered = sorted(jobs, key=lambda job: job.id)

    total = len(ordered)
    paged_jobs = ordered[(page - 1) * page_size: page * page_size]

    return JobListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_to_job_summary(j) for j in paged_jobs],
    )


async def get_job(db: AsyncSession, job_id: int) -> JobDetail:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _to_job_detail(job)


async def get_filters(db: AsyncSession) -> FiltersResponse:
    # Load all jobs to apply normalization (handles work_cities JSON and city normalization)
    result = await db.execute(select(Job))
    jobs = result.scalars().all()

    city_set = set()
    recruit_type_set = set()
    category_set = set()
    company_set = set()

    for job in jobs:
        city_set.update(_job_cities(job))
        if job.recruit_type:
            recruit_type_set.add(job.recruit_type)
        category = normalize_job_category(job.job_category)
        if category:
            category_set.add(category)
        if job.company:
            company_set.add(job.company)

    return FiltersResponse(
        cities=_sort_cities(list(city_set)),
        recruit_types=sorted(recruit_type_set),
        job_categories=sorted(category_set),
        companies=sorted(company_set),
    )


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
    # Build base query with filters, excluding one field at a time
    base_query = select(Job)

    # Cities: exclude city filter
    city_query = _apply_filters(base_query, recruit_type=recruit_type,
                                job_category=job_category, company=company)
    city_result = await db.execute(select(Job.work_city).distinct().where(Job.work_city.isnot(None)).select_from(city_query.subquery()))
    cities = [c[0] for c in city_result.all() if c[0]]

    # Recruit types: exclude recruit_type filter
    type_query = _apply_filters(base_query, job_category=job_category, company=company)
    type_result = await db.execute(select(Job.recruit_type).distinct().where(Job.recruit_type.isnot(None)).select_from(type_query.subquery()))
    recruit_types = sorted([r[0] for r in type_result.all() if r[0]])

    # Categories: exclude job_category filter
    cat_query = _apply_filters(base_query, recruit_type=recruit_type, company=company)
    cat_result = await db.execute(select(Job.job_category).distinct().where(Job.job_category.isnot(None)).select_from(cat_query.subquery()))
    categories = set()
    for c in cat_result.all():
        if c[0]:
            normalized = normalize_job_category(c[0])
            if normalized:
                categories.add(normalized)

    # Companies: exclude company filter
    comp_query = _apply_filters(base_query, recruit_type=recruit_type, job_category=job_category)
    comp_result = await db.execute(select(Job.company).distinct().where(Job.company.isnot(None)).select_from(comp_query.subquery()))
    companies = sorted([c[0] for c in comp_result.all() if c[0]])

    return DynamicFiltersResponse(
        cities=_sort_cities(cities),
        recruit_types=recruit_types,
        job_categories=sorted(categories),
        companies=companies,
    )


def _job_cities(job: Job) -> list[str]:
    return normalize_city_values(job.work_city, job.work_cities or [])


def _job_category(job: Job) -> Optional[str]:
    return normalize_job_category(job.job_category)


def _to_job_summary(job: Job) -> JobSummary:
    cities = _job_cities(job)
    return JobSummary.model_validate(
        {
            "id": job.id,
            "job_id": job.job_id,
            "company": job.company,
            "title": job.title,
            "recruit_type": job.recruit_type,
            "job_category": _job_category(job),
            "work_city": cities[0] if cities else None,
            "publish_time": job.publish_time,
            "detail_url": job.detail_url,
        }
    )


def _to_job_detail(job: Job) -> JobDetail:
    cities = _job_cities(job)
    return JobDetail.model_validate(
        {
            "id": job.id,
            "job_id": job.job_id,
            "company": job.company,
            "title": job.title,
            "recruit_type": job.recruit_type,
            "job_category": _job_category(job),
            "job_function": job.job_function,
            "work_city": cities[0] if cities else None,
            "work_cities": cities,
            "team_intro": job.team_intro,
            "responsibilities": job.responsibilities,
            "requirements": job.requirements,
            "bonus_points": job.bonus_points,
            "tags": job.tags,
            "publish_time": job.publish_time,
            "detail_url": job.detail_url,
            "fetched_at": job.fetched_at,
        }
    )


def _apply_filters(query, recruit_type=None, job_category=None, company=None):
    """Apply SQL WHERE filters. Multi-value support: same-field OR, cross-field AND."""

    # Recruit type filter (multi-value)
    if recruit_type:
        type_values = [t.strip() for t in recruit_type.split(',') if t.strip()]
        if type_values:
            type_conditions = [Job.recruit_type == tv for tv in type_values]
            query = query.where(or_(*type_conditions))

    # Job category filter (multi-value)
    if job_category:
        cat_values = [c.strip() for c in job_category.split(',') if c.strip()]
        if cat_values:
            cat_conditions = [Job.job_category == cv for cv in cat_values]
            query = query.where(or_(*cat_conditions))

    # Company filter (multi-value, partial match)
    if company:
        comp_values = [c.strip() for c in company.split(',') if c.strip()]
        if comp_values:
            comp_conditions = [Job.company.like(f'%{cv}%') for cv in comp_values]
            query = query.where(or_(*comp_conditions))

    return query


def _filter_jobs(
    jobs: list[Job],
    q: Optional[str] = None,
    city: Optional[str] = None,
    recruit_type: Optional[str] = None,
    job_category: Optional[str] = None,
    company: Optional[str] = None,
    skip: Optional[set[str]] = None,
) -> list[Job]:
    skip = skip or set()

    city_mode, city_value_raw = parse_signed_filter(city)
    city_value = normalize_city_token(city_value_raw) if city_value_raw else None

    company_mode, company_value = parse_signed_filter(company)
    company_value = (company_value or "").lower() or None

    cat_mode, cat_value_raw = parse_signed_filter(job_category)
    cat_value = normalize_job_category(cat_value_raw) if cat_value_raw else None

    filtered: list[Job] = []
    for job in jobs:
        job_cities = _job_cities(job)
        job_cat = _job_category(job)
        job_company = (job.company or "").lower()

        if "city" not in skip and city_value:
            if city_mode == "include" and city_value not in job_cities:
                continue
            if city_mode == "exclude" and city_value in job_cities:
                continue

        if "recruit_type" not in skip and recruit_type and job.recruit_type != recruit_type:
            continue

        if "job_category" not in skip and cat_value:
            if cat_mode == "include" and job_cat != cat_value:
                continue
            if cat_mode == "exclude" and job_cat == cat_value:
                continue

        if "company" not in skip and company_value:
            contains = company_value in job_company
            if company_mode == "include" and not contains:
                continue
            if company_mode == "exclude" and contains:
                continue

        filtered.append(job)

    if q and "q" not in skip:
        return _rank_jobs_by_hybrid(q, filtered)
    return filtered


def _rank_jobs_by_hybrid(query: str, jobs: list[Job]) -> list[Job]:
    query_tokens = tokenize_text(query)
    if not query_tokens:
        return jobs

    docs_for_bm25 = [tokenize_text(job.title) for job in jobs]
    docs_for_vector = [
        tokenize_text(" ".join(filter(None, [job.responsibilities, job.requirements, job.bonus_points])))
        for job in jobs
    ]

    bm25 = bm25_scores(query_tokens, docs_for_bm25)
    docs_for_vector_text = [" ".join(filter(None, [job.responsibilities, job.requirements, job.bonus_points])) for job in jobs]
    vec = semantic_vector_scores(query, docs_for_vector_text, model_name=settings.EMBEDDING_MODEL)
    if vec is None:
        vec = cosine_tfidf_scores(query_tokens, docs_for_vector)
    rrf = rrf_merge(bm25, vec)

    ranked = []
    query_str = query.lower()
    for i, job in enumerate(jobs):
        title = (job.title or "").lower()
        title_boost = 0.0
        if query_str and query_str in title:
            title_boost += 0.08
        if query_tokens:
            overlap = len(set(tokenize_text(job.title)) & set(query_tokens)) / max(1, len(set(query_tokens)))
            title_boost += overlap * 0.06

        score = rrf[i] + title_boost
        if score > 0:
            ranked.append((score, job))

    ranked.sort(key=lambda x: x[0], reverse=True)
    return [job for _, job in ranked]
