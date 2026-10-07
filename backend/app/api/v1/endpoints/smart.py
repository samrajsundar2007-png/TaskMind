from typing import Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.crud import user as crud_user
from app.smart.briefing import generate_daily_briefing, generate_weekly_review
from app.smart.overload import analyze_daily_workload

router = APIRouter(prefix="/smart", tags=["Smart Features"])


@router.get("/daily-briefing", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
def get_daily_briefing(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retrieve daily morning briefing with today's schedule, overdue items, and workload alerts."""
    user = None
    if user_id:
        user = crud_user.get_user(db, user_id=user_id)
    if not user:
        user = crud_user.get_or_create_default_user(db)

    return generate_daily_briefing(db, user=user)


@router.get("/weekly-review", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
def get_weekly_review(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retrieve weekly review covering completed tasks, on-time rate, and category distribution."""
    user = None
    if user_id:
        user = crud_user.get_user(db, user_id=user_id)
    if not user:
        user = crud_user.get_or_create_default_user(db)

    return generate_weekly_review(db, user=user)


@router.get("/workload", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
def get_workload_analysis(
    user_id: Optional[int] = None,
    date_str: Optional[str] = Query(None, description="ISO date or target date to analyze"),
    threshold_minutes: int = Query(360, ge=60, le=1440),
    db: Session = Depends(get_db),
):
    """Analyze daily workload and check for overload warnings."""
    user = None
    if user_id:
        user = crud_user.get_user(db, user_id=user_id)
    if not user:
        user = crud_user.get_or_create_default_user(db)

    target_dt = datetime.fromisoformat(date_str) if date_str else datetime.now(timezone.utc)
    analysis = analyze_daily_workload(db, user=user, target_date=target_dt, threshold_minutes=threshold_minutes)
    return analysis.to_dict()
