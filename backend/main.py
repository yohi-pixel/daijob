from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from config import settings
from routers import auth, jobs, ai
from routers import resume_parse


async def import_jobs_if_empty(jobs_file: str):
    from scripts.import_jobs import run_import
    await run_import(jobs_file)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await import_jobs_if_empty(settings.JOBS_FILE)
    yield


app = FastAPI(title="YesJob API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(resume_parse.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
