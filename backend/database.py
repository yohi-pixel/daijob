from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings

# SQLite async engine does not accept pool sizing args.
engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
}
if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

# MySQL connection using aiomysql
engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
