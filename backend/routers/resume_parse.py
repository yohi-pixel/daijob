from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.auth_service import get_current_user
from schemas.resume_parse import ParsedResume
from services.resume_parse_service import parse_resume

router = APIRouter(prefix="/api/resume", tags=["resume-parse"])


@router.post("/parse", response_model=ParsedResume)
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    has_basic_info: bool = Form(False),
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ParsedResume:
    file_bytes = await file.read()
    return await parse_resume(file_bytes, file.filename or "", has_basic_info)
