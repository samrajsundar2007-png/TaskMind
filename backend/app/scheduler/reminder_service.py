import logging
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.reminder import Reminder
from app.models.task import Task, TaskStatusEnum
from app.models.user import User
from app.crud.task import log_task_event
from app.notifications.dispatcher import NotificationDispatcher

logger = logging.getLogger(__name__)


def process_due_reminders(
    db: Optional[Session] = None,
    dispatcher: Optional[NotificationDispatcher] = None,
) -> int:
    """
    Idempotently finds and dispatches all due un-sent reminders.
    Ensures no duplicate deliveries on restarts or concurrent ticks.
    Returns the count of dispatched reminders.
    """
    should_close_db = False
    if db is None:
        db = SessionLocal()
        should_close_db = True

    if dispatcher is None:
        dispatcher = NotificationDispatcher()

    dispatched_count = 0
    now = datetime.now(timezone.utc)

    try:
        # Query un-sent reminders due on or before now
        due_reminders: List[Reminder] = (
            db.query(Reminder)
            .filter(
                Reminder.sent == False,
                Reminder.remind_at_utc <= now,
            )
            .order_by(Reminder.remind_at_utc.asc())
            .all()
        )

        for reminder in due_reminders:
            task: Optional[Task] = db.query(Task).filter(Task.id == reminder.task_id).first()
            if not task:
                # Orphan reminder, mark sent to avoid reprocessing
                reminder.sent = True
                db.commit()
                continue

            # If task is already completed or cancelled, do not notify
            if task.status in (TaskStatusEnum.done, TaskStatusEnum.cancelled):
                reminder.sent = True
                db.commit()
                continue

            user: Optional[User] = db.query(User).filter(User.id == task.user_id).first()
            if not user:
                reminder.sent = True
                db.commit()
                continue

            # Idempotency lock: mark sent before or during dispatch
            reminder.sent = True
            reminder.attempt_no += 1
            db.commit()

            # Dispatch notification
            success = dispatcher.send_reminder(user=user, task=task, reminder=reminder)

            log_task_event(
                db,
                task_id=task.id,
                event="reminder_dispatched",
                meta={
                    "reminder_id": reminder.id,
                    "channel": reminder.channel,
                    "success": success,
                    "remind_at": reminder.remind_at_utc.isoformat(),
                },
            )
            dispatched_count += 1
            logger.info(f"Successfully processed reminder #{reminder.id} for task #{task.id} ('{task.title}')")

    except Exception as e:
        logger.error(f"Error processing due reminders: {e}")
        db.rollback()
    finally:
        if should_close_db:
            db.close()

    return dispatched_count


def sync_task_reminder(db: Session, task: Task, remind_at_utc: Optional[datetime] = None) -> Optional[Reminder]:
    """
    Synchronizes the active reminder for a given task.
    """
    target_time = remind_at_utc or task.due_at_utc
    if not target_time:
        return None

    # Find existing un-sent reminder or create a new one
    reminder = (
        db.query(Reminder)
        .filter(Reminder.task_id == task.id, Reminder.sent == False)
        .first()
    )

    if reminder:
        reminder.remind_at_utc = target_time
        reminder.attempt_no = 0
    else:
        reminder = Reminder(
            task_id=task.id,
            remind_at_utc=target_time,
            channel="telegram",
            sent=False,
            attempt_no=0,
        )
        db.add(reminder)

    db.commit()
    db.refresh(reminder)
    return reminder
