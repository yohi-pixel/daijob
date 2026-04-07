from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    company: Mapped[Optional[str]] = mapped_column(String(200))
    title: Mapped[Optional[str]] = mapped_column(String(300), index=True)
    recruit_type: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    job_category: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    job_function: Mapped[Optional[str]] = mapped_column(String(100))
    work_city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    work_cities: Mapped[Optional[list]] = mapped_column(JSON)
    team_intro: Mapped[Optional[str]] = mapped_column(Text)
    responsibilities: Mapped[Optional[str]] = mapped_column(Text)
    requirements: Mapped[Optional[str]] = mapped_column(Text)
    bonus_points: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list]] = mapped_column(JSON)
    publish_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    detail_url: Mapped[Optional[str]] = mapped_column(String(500))
    fetched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    source_page: Mapped[Optional[str]] = mapped_column(String(20))
