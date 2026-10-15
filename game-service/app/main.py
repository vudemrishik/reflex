"""Game-service FastAPI application entry-point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import Database
from app.redis_client import RedisClient
from app.routes.sessions import router as sessions_router

# from app.routes.leaderboard import router as leaderboard_router  # DISABLED


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup / shutdown of database pool and Redis."""
    await Database.connect()
    await RedisClient.connect()
    yield
    await RedisClient.disconnect()
    await Database.disconnect()


app = FastAPI(
    title="Reflex Game Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(sessions_router)
# app.include_router(leaderboard_router)  # DISABLED — single-player focus


@app.get("/health")
async def health():
    return {"status": "ok", "service": "game"}
