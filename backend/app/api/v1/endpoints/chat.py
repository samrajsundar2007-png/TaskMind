from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.crud import user as crud_user
from app.agent.agent_loop import AgentLoop

router = APIRouter(prefix="/chat", tags=["Chat & Agent"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Natural language user input")
    session_id: Optional[str] = Field(None, description="Optional session/conversation ID")
    user_id: Optional[int] = Field(None, description="User ID (defaults to default user)")


class ChatResponse(BaseModel):
    reply: str
    tool_calls: List[Dict[str, Any]] = []
    requires_confirmation: bool = False
    session_id: str


@router.post("/", response_model=ChatResponse, status_code=status.HTTP_200_OK)
def chat_with_agent(
    payload: ChatRequest,
    db: Session = Depends(get_db),
):
    """
    Natural language chat interface with TaskMind AI Agent.
    Parses intent, calls tools, executes actions, and returns short 1-2 sentence response.
    """
    user = None
    if payload.user_id:
        user = crud_user.get_user(db, user_id=payload.user_id)
    if not user:
        user = crud_user.get_or_create_default_user(db)

    agent = AgentLoop(
        db=db,
        user=user,
        session_id=payload.session_id or f"session_{user.id}",
    )

    response = agent.process_message(payload.message)
    return ChatResponse(
        reply=response.reply,
        tool_calls=response.tool_calls,
        requires_confirmation=response.requires_confirmation,
        session_id=response.session_id,
    )
