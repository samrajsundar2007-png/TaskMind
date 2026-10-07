from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
import pytz

from app.models.task import Task, PriorityEnum, TaskStatusEnum
from app.models.task_event import TaskEvent
from app.models.user import User
from app.agent.date_parser import get_user_timezone
from app.agent.tool_executor import format_local_time
from app.smart.overload import analyze_daily_workload


def generate_daily_briefing(db: Session, user: User) -> Dict[str, Any]:
    """
    Generates a structured daily morning briefing with today's tasks, overdue items, and workload alerts.
    """
    user_tz = get_user_timezone(user.timezone)
    now_utc = datetime.now(timezone.utc)
    local_now = now_utc.astimezone(user_tz)

    today_start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end_local = today_start_local + timedelta(days=1)

    today_start_utc = today_start_local.astimezone(timezone.utc)
    today_end_utc = today_end_local.astimezone(timezone.utc)

    # 1. Overdue tasks
    overdue_tasks: List[Task] = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.status.in_([TaskStatusEnum.pending, TaskStatusEnum.snoozed]),
            Task.due_at_utc != None,
            Task.due_at_utc < today_start_utc,
        )
        .order_by(Task.priority.desc(), Task.due_at_utc.asc())
        .all()
    )

    # 2. Today's tasks
    today_tasks: List[Task] = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.status.in_([TaskStatusEnum.pending, TaskStatusEnum.snoozed]),
            Task.due_at_utc >= today_start_utc,
            Task.due_at_utc < today_end_utc,
        )
        .order_by(Task.due_at_utc.asc())
        .all()
    )

    # 3. Workload analysis
    workload = analyze_daily_workload(db, user, target_date=now_utc)

    # Format text briefing
    greeting_lines = [
        f"🌅 **Good morning, {user.name}! Here is your Daily Briefing for {local_now.strftime('%A, %B %d')}:**\n"
    ]

    if overdue_tasks:
        greeting_lines.append(f"⚠️ **Attention ({len(overdue_tasks)} Overdue Task{'s' if len(overdue_tasks) > 1 else ''}):**")
        for t in overdue_tasks[:3]:
            greeting_lines.append(f" • #{t.id} {t.title} (Priority: {t.priority.value.upper()})")
        if len(overdue_tasks) > 3:
            greeting_lines.append(f" • ...and {len(overdue_tasks) - 3} more")
        greeting_lines.append("")

    if today_tasks:
        greeting_lines.append(f"📋 **Today's Agenda ({len(today_tasks)} tasks):**")
        for t in today_tasks:
            due_str = format_local_time(t.due_at_utc, user.timezone)
            p_badge = "🔴" if t.priority == PriorityEnum.high else ("🟡" if t.priority == PriorityEnum.med else "🟢")
            greeting_lines.append(f" • {p_badge} **#{t.id} {t.title}** at {due_str}")
        greeting_lines.append("")
    else:
        greeting_lines.append("✨ You have no scheduled tasks for today! Enjoy your day or add new tasks as they come.\n")

    if workload.is_overloaded and workload.warning_message:
        greeting_lines.append(workload.warning_message)

    formatted_text = "\n".join(greeting_lines)

    return {
        "user_name": user.name,
        "date": local_now.strftime("%Y-%m-%d"),
        "formatted_date": local_now.strftime("%A, %B %d, %Y"),
        "overdue_count": len(overdue_tasks),
        "today_count": len(today_tasks),
        "workload": workload.to_dict(),
        "briefing_text": formatted_text,
    }


def generate_weekly_review(db: Session, user: User) -> Dict[str, Any]:
    """
    Generates a weekly productivity review covering completed tasks, on-time completion rates,
    category distribution, and upcoming rollovers for the past 7 days.
    """
    now_utc = datetime.now(timezone.utc)
    seven_days_ago_utc = now_utc - timedelta(days=7)

    # 1. Tasks completed in last 7 days
    completed_tasks: List[Task] = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.status == TaskStatusEnum.done,
            Task.completed_at >= seven_days_ago_utc,
        )
        .all()
    )

    total_completed = len(completed_tasks)
    on_time_count = 0
    for t in completed_tasks:
        if t.due_at_utc is None or (t.completed_at and t.completed_at <= t.due_at_utc + timedelta(hours=1)):
            on_time_count += 1

    on_time_rate = round((on_time_count / total_completed * 100) if total_completed > 0 else 100.0, 1)

    # 2. Category breakdown
    category_counts: Dict[str, int] = {}
    for t in completed_tasks:
        cat = t.category or "General"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    # 3. Snoozed events in last 7 days
    snooze_count = (
        db.query(TaskEvent)
        .join(Task, TaskEvent.task_id == Task.id)
        .filter(
            Task.user_id == user.id,
            TaskEvent.event == "snoozed",
            TaskEvent.created_at >= seven_days_ago_utc,
        )
        .count()
    )

    # 4. Pending tasks rolling over into next week
    pending_rollover_count = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.status.in_([TaskStatusEnum.pending, TaskStatusEnum.snoozed]),
        )
        .count()
    )

    review_lines = [
        f"📊 **Weekly Review for {user.name} (Past 7 Days):**\n",
        f"🏆 **Completed Tasks:** {total_completed}",
        f"🎯 **On-Time Completion Rate:** {on_time_rate}%",
        f"⏳ **Tasks Snoozed:** {snooze_count}",
        f"📌 **Active Backlog / Rollover:** {pending_rollover_count} pending tasks\n",
    ]

    if category_counts:
        review_lines.append("**Category Focus:**")
        for cat, count in category_counts.items():
            review_lines.append(f" • {cat}: {count} task(s)")
        review_lines.append("")

    if on_time_rate >= 80 and total_completed >= 5:
        review_lines.append("🌟 **Productivity Insight:** Fantastic focus this week! Keep up the great momentum.")
    else:
        review_lines.append("💡 **Productivity Tip:** Try prioritizing top 3 tasks daily to boost on-time completion.")

    return {
        "total_completed": total_completed,
        "on_time_rate": on_time_rate,
        "snooze_count": snooze_count,
        "pending_rollover": pending_rollover_count,
        "categories": category_counts,
        "review_text": "\n".join(review_lines),
    }
