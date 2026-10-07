import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.task import Task, PriorityEnum, TaskStatusEnum
from app.models.reminder import Reminder
from app.models.user import User
from app.crud.task import log_task_event
from app.notifications.dispatcher import NotificationDispatcher
from app.agent.tool_executor import format_local_time

logger = logging.getLogger(__name__)


def process_escalating_reminders(
    db: Session,
    dispatcher: Optional[NotificationDispatcher] = None,
    max_escalations: int = 3,
    escalation_interval_minutes: int = 15,
) -> int:
    """
    Checks for overdue HIGH priority tasks that have not been completed or snoozed,
    and dispatches escalating notifications if sufficient time has elapsed since the last reminder.
    """
    if dispatcher is None:
        dispatcher = NotificationDispatcher()

    now = datetime.now(timezone.utc)
    escalated_count = 0

    # Query active high priority tasks with past due dates
    high_priority_tasks: List[Task] = (
        db.query(Task)
        .filter(
            Task.priority == PriorityEnum.high,
            Task.status == TaskStatusEnum.pending,
            Task.due_at_utc != None,
            Task.due_at_utc < now,
        )
        .all()
    )

    for task in high_priority_tasks:
        user = db.query(User).filter(User.id == task.user_id).first()
        if not user:
            continue

        # Check existing reminders
        reminders = (
            db.query(Reminder)
            .filter(Reminder.task_id == task.id)
            .order_by(Reminder.id.desc())
            .all()
        )

        sent_count = sum(r.attempt_no for r in reminders if r.sent)
        if sent_count >= max_escalations:
            continue  # Reached maximum escalation attempts

        # Check if enough time has passed since due time or last attempt
        last_remind_time = max([r.remind_at_utc for r in reminders] + [task.due_at_utc])
        if last_remind_time.tzinfo is None:
            last_remind_time = last_remind_time.replace(tzinfo=timezone.utc)

        time_since_last = (now - last_remind_time).total_seconds() / 60
        if time_since_last >= escalation_interval_minutes or sent_count == 0:
            # Dispatch escalation
            attempt = sent_count + 1
            user_tz = user.timezone or "UTC"
            formatted_due = format_local_time(task.due_at_utc, user_tz)

            # Create an escalation reminder record
            esc_reminder = Reminder(
                task_id=task.id,
                remind_at_utc=now,
                channel="telegram",
                sent=True,
                attempt_no=attempt,
            )
            db.add(esc_reminder)
            db.commit()

            # Dispatch via NotificationDispatcher
            success = dispatcher.send_reminder(user=user, task=task, reminder=esc_reminder)

            log_task_event(
                db,
                task_id=task.id,
                event="escalation_sent",
                meta={
                    "attempt": attempt,
                    "max_escalations": max_escalations,
                    "success": success,
                },
            )
            escalated_count += 1
            logger.info(f"Dispatched Escalation #{attempt} for high-priority task #{task.id} ('{task.title}')")

    return escalated_count
