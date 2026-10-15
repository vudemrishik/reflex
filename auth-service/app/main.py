"""Auth-service FastAPI application entry-point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import Database
from app.routes.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup / shutdown of the database pool."""
    await Database.connect()
    yield
    await Database.disconnect()


app = FastAPI(
    title="Reflex Auth Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth"}
