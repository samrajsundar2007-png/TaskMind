from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
import pytz

from app.models.task import Task, PriorityEnum, TaskStatusEnum
from app.models.user import User
from app.agent.date_parser import get_user_timezone


class WorkloadAnalysis:
    def __init__(
        self,
        date_str: str,
        total_estimated_minutes: int,
        total_tasks: int,
        high_priority_tasks: int,
        is_overloaded: bool,
        warning_message: Optional[str] = None,
        suggested_actions: Optional[List[str]] = None,
    ):
        self.date_str = date_str
        self.total_estimated_minutes = total_estimated_minutes
        self.total_tasks = total_tasks
        self.high_priority_tasks = high_priority_tasks
        self.is_overloaded = is_overloaded
        self.warning_message = warning_message
        self.suggested_actions = suggested_actions or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "date": self.date_str,
            "total_estimated_minutes": self.total_estimated_minutes,
            "total_estimated_hours": round(self.total_estimated_minutes / 60, 1),
            "total_tasks": self.total_tasks,
            "high_priority_tasks": self.high_priority_tasks,
            "is_overloaded": self.is_overloaded,
            "warning_message": self.warning_message,
            "suggested_actions": self.suggested_actions,
        }


def analyze_daily_workload(
    db: Session,
    user: User,
    target_date: Optional[datetime] = None,
    threshold_minutes: int = 360,  # 6 hours
) -> WorkloadAnalysis:
    """
    Evaluates the user's scheduled tasks for a given date and detects workload overload.
    """
    user_tz = get_user_timezone(user.timezone)
    now_utc = datetime.now(timezone.utc)
    if target_date is None:
        target_date = now_utc

    local_dt = target_date.astimezone(user_tz)
    day_start_local = local_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end_local = day_start_local + timedelta(days=1)

    day_start_utc = day_start_local.astimezone(timezone.utc)
    day_end_utc = day_end_local.astimezone(timezone.utc)

    # Query tasks due on this day
    tasks: List[Task] = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.status.in_([TaskStatusEnum.pending, TaskStatusEnum.snoozed]),
            Task.due_at_utc >= day_start_utc,
            Task.due_at_utc < day_end_utc,
        )
        .all()
    )

    total_tasks = len(tasks)
    total_minutes = sum(t.estimated_minutes or 30 for t in tasks)
    high_priority = sum(1 for t in tasks if t.priority == PriorityEnum.high)

    is_overloaded = total_minutes > threshold_minutes or total_tasks >= 8 or high_priority >= 5
    warning_message = None
    suggested_actions = []

    if is_overloaded:
        hours = round(total_minutes / 60, 1)
        warning_message = (
            f"⚠️ Workload Alert: You have {total_tasks} tasks scheduled for {local_dt.strftime('%b %d')} "
            f"totaling ~{hours} hours ({high_priority} high priority), exceeding your daily capacity limit of {threshold_minutes // 60} hours."
        )

        low_tasks = [t for t in tasks if t.priority == PriorityEnum.low]
        if low_tasks:
            suggested_actions.append(f"Postpone {len(low_tasks)} low-priority task(s) to tomorrow or the weekend.")
        if high_priority > 3:
            suggested_actions.append("Focus on top 3 critical priorities and delegate or defer the rest.")
        suggested_actions.append("Add buffer time between tasks to prevent schedule overflow.")

    return WorkloadAnalysis(
        date_str=local_dt.strftime("%Y-%m-%d"),
        total_estimated_minutes=total_minutes,
        total_tasks=total_tasks,
        high_priority_tasks=high_priority,
        is_overloaded=is_overloaded,
        warning_message=warning_message,
        suggested_actions=suggested_actions,
    )
