"""Redis client lifecycle & helpers for leaderboard sorted sets."""

from __future__ import annotations

import redis.asyncio as aioredis

from app.config import settings


class RedisClient:
    """Manages an async Redis connection pool."""

    client: aioredis.Redis | None = None

    @classmethod
    async def connect(cls) -> None:
        cls.client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=20,
        )

    @classmethod
    async def disconnect(cls) -> None:
        if cls.client:
            await cls.client.aclose()
            cls.client = None

    @classmethod
    def get(cls) -> aioredis.Redis:
        assert cls.client is not None, "Redis client not initialised"
        return cls.client

    # ── Leaderboard helpers ─────────────────────────────────
    @classmethod
    def leaderboard_key(cls, game_slug: str) -> str:
        return f"lb:{game_slug}"

    @classmethod
    def user_info_key(cls, user_id: str) -> str:
        return f"user:{user_id}"

    @classmethod
    async def update_leaderboard(
        cls,
        game_slug: str,
        user_id: str,
        score: int,
        display_name: str,
        avatar_url: str | None,
    ) -> None:
        """Add / update the user's best score in the Redis sorted set."""
        r = cls.get()
        lb_key = cls.leaderboard_key(game_slug)

        # ZADD with GT: only update if the new score > existing score
        await r.zadd(lb_key, {user_id: score}, gt=True)

        # Cache user display data for leaderboard rendering
        await r.hset(
            cls.user_info_key(user_id),
            mapping={
                "display_name": display_name,
                "avatar_url": avatar_url or "",
            },
        )

    @classmethod
    async def get_leaderboard(
        cls, game_slug: str, top_n: int = 100
    ) -> list[dict]:
        """Return the top-N from the Redis sorted set with user info."""
        r = cls.get()
        lb_key = cls.leaderboard_key(game_slug)

        # ZREVRANGE returns [(member, score), ...]
        entries = await r.zrevrange(lb_key, 0, top_n - 1, withscores=True)

        results: list[dict] = []
        for rank, (user_id, score) in enumerate(entries, start=1):
            info = await r.hgetall(cls.user_info_key(user_id))
            results.append(
                {
                    "rank": rank,
                    "user_id": user_id,
                    "score": int(score),
                    "display_name": info.get("display_name", "Unknown"),
                    "avatar_url": info.get("avatar_url") or None,
                }
            )
        return results
