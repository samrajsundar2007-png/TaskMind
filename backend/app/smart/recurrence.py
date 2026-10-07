import re
from datetime import datetime, timezone, timedelta
from typing import Optional
from dateutil.rrule import rrulestr, rrule, DAILY, WEEKLY, MONTHLY, YEARLY, MO, TU, WE, TH, FR, SA, SU
from sqlalchemy.orm import Session

from app.models.task import Task, TaskStatusEnum
from app.models.reminder import Reminder
from app.crud.task import log_task_event


def normalize_rrule(rule_text: str) -> str:
    """Normalizes natural recurrence phrases into standard iCalendar RRULE format."""
    cleaned = rule_text.strip()
    upper = cleaned.upper()

    if upper.startswith("RRULE:"):
        upper = upper[6:].strip()

    if "FREQ=" in upper:
        return upper

    lower = cleaned.lower()
    if lower in ("daily", "every day", "everyday"):
        return "FREQ=DAILY"
    elif lower in ("every weekday", "weekdays"):
        return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    elif lower in ("weekly", "every week"):
        return "FREQ=WEEKLY"
    elif lower in ("monthly", "every month"):
        return "FREQ=MONTHLY"
    elif lower in ("yearly", "every year", "annually"):
        return "FREQ=YEARLY"

    # Match "every Monday", "every Friday", etc.
    day_map = {
        "monday": "MO", "mon": "MO",
        "tuesday": "TU", "tue": "TU",
        "wednesday": "WE", "wed": "WE",
        "thursday": "TH", "thu": "TH",
        "friday": "FR", "fri": "FR",
        "saturday": "SA", "sat": "SA",
        "sunday": "SU", "sun": "SU",
    }
    every_day_match = re.search(r'every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)', lower)
    if every_day_match:
        day_code = day_map.get(every_day_match.group(1))
        if day_code:
            return f"FREQ=WEEKLY;BYDAY={day_code}"

    # Default fallback
    return "FREQ=DAILY"


def compute_next_due_date(
    recurrence_rule: str,
    current_due_utc: Optional[datetime] = None,
    base_time_utc: Optional[datetime] = None,
) -> Optional[datetime]:
    """
    Computes the next occurrence datetime in UTC based on recurrence rule.
    """
    if not recurrence_rule:
        return None

    norm_rule = normalize_rrule(recurrence_rule)
    now = base_time_utc or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    start_dt = current_due_utc or now
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    # Use naive datetime for dateutil rrule calculation then restore UTC
    start_dt_naive = start_dt.replace(tzinfo=None)
    now_naive = now.replace(tzinfo=None)

    try:
        rule_obj = rrulestr(norm_rule, dtstart=start_dt_naive)
        # Find next occurrence strictly after the current due date (or now)
        after_target = max(start_dt_naive, now_naive)
        next_dt = rule_obj.after(after_target, inc=False)

        if not next_dt:
            # Fallback +1 day or +1 week if after returned None
            if "WEEKLY" in norm_rule:
                next_dt = start_dt_naive + timedelta(weeks=1)
            elif "MONTHLY" in norm_rule:
                next_dt = start_dt_naive + timedelta(days=30)
            else:
                next_dt = start_dt_naive + timedelta(days=1)

        return next_dt.replace(tzinfo=timezone.utc)
    except Exception:
        # Fallback to +1 day
        return (start_dt + timedelta(days=1)).astimezone(timezone.utc)


def spawn_recurring_task(db: Session, completed_task: Task) -> Optional[Task]:
    """
    When a recurring task is completed, automatically spawns the next pending instance.
    """
    if not completed_task.recurrence_rule:
        return None

    next_due_utc = compute_next_due_date(
        recurrence_rule=completed_task.recurrence_rule,
        current_due_utc=completed_task.due_at_utc,
    )

    new_task = Task(
        user_id=completed_task.user_id,
        title=completed_task.title,
        description=completed_task.description,
        due_at_utc=next_due_utc,
        priority=completed_task.priority,
        category=completed_task.category,
        recurrence_rule=completed_task.recurrence_rule,
        estimated_minutes=completed_task.estimated_minutes,
        status=TaskStatusEnum.pending,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_task)
    db.flush()

    # Schedule reminder for the next instance
    if next_due_utc:
        reminder = Reminder(
            task_id=new_task.id,
            remind_at_utc=next_due_utc,
            channel="telegram",
            sent=False,
            attempt_no=0,
        )
        db.add(reminder)

    log_task_event(
        db,
        task_id=completed_task.id,
        event="recurrence_spawned",
        meta={
            "previous_task_id": completed_task.id,
            "next_task_id": new_task.id,
            "next_due_at": next_due_utc.isoformat() if next_due_utc else None,
            "rule": completed_task.recurrence_rule,
        },
        commit=False,
    )

    db.commit()
    db.refresh(new_task)
    return new_task
