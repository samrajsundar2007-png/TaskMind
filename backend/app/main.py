from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
from app.api.v1.router import api_router
from app.scheduler.lifecycle import (
    start_scheduler,
    stop_scheduler,
    start_telegram_bot,
    stop_telegram_bot,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    # Start Scheduler & Telegram Bot
    start_scheduler()
    await start_telegram_bot()
    
    yield
    
    # Shutdown
    await stop_telegram_bot()
    stop_scheduler()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="TaskMind: AI-Powered Task Remember Agent & Deterministic Scheduler API",
    lifespan=lifespan,
)

# CORS middleware
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_router)


@app.get("/", tags=["Root"])
def read_root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_url": "/api/v1/health",
        "description": "TaskMind AI Task-Remember Agent API"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )
