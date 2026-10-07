from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, tasks, chat, smart, voice

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(tasks.router)
api_router.include_router(chat.router)
api_router.include_router(smart.router)
api_router.include_router(voice.router)
