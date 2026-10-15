"""AsyncPG connection pool management."""

from __future__ import annotations

import asyncpg

from app.config import settings


class Database:
    """Thin wrapper around an asyncpg connection pool."""

    pool: asyncpg.Pool | None = None

    @classmethod
    async def connect(cls) -> None:
        cls.pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=5,
            max_size=20,
            command_timeout=10,
        )

    @classmethod
    async def disconnect(cls) -> None:
        if cls.pool:
            await cls.pool.close()
            cls.pool = None

    @classmethod
    def get_pool(cls) -> asyncpg.Pool:
        assert cls.pool is not None, "Database pool not initialised"
        return cls.pool
