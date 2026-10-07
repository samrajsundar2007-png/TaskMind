import asyncio
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock

from app.models.user import User
from app.models.task import Task, PriorityEnum, TaskStatusEnum
from app.models.reminder import Reminder
from app.scheduler.reminder_service import process_due_reminders, sync_task_reminder
from app.notifications.dispatcher import NotificationDispatcher
from app.notifications.telegram_bot import handle_callback_query


class MockDispatcher(NotificationDispatcher):
    def __init__(self):
        super().__init__(bot_token="mock_token")
        self.dispatched = []

    def send_reminder(self, user: User, task: Task, reminder: Reminder) -> bool:
        self.dispatched.append({
            "user_id": user.id,
            "task_id": task.id,
            "title": task.title,
            "reminder_id": reminder.id,
        })
        return True


def test_reminder_dispatch_and_idempotency(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)

    # 1. Create a task with a due reminder in the past (due 10 minutes ago)
    task = Task(
        user_id=user.id,
        title="Submit Timesheet",
        due_at_utc=now - timedelta(minutes=10),
        priority=PriorityEnum.high,
        status=TaskStatusEnum.pending,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    reminder = Reminder(
        task_id=task.id,
        remind_at_utc=task.due_at_utc,
        channel="telegram",
        sent=False,
    )
    db_session.add(reminder)
    db_session.commit()

    dispatcher = MockDispatcher()

    # First run: should find and dispatch the reminder
    count1 = process_due_reminders(db=db_session, dispatcher=dispatcher)
    assert count1 == 1
    assert len(dispatcher.dispatched) == 1
    assert dispatcher.dispatched[0]["task_id"] == task.id

    # Check reminder is marked sent in DB
    db_session.refresh(reminder)
    assert reminder.sent is True
    assert reminder.attempt_no == 1

    # Second run (Idempotency test): should NOT re-dispatch
    count2 = process_due_reminders(db=db_session, dispatcher=dispatcher)
    assert count2 == 0
    assert len(dispatcher.dispatched) == 1  # No duplicate


def test_future_reminders_not_dispatched(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)

    # Create task with future reminder (+2 hours)
    task = Task(
        user_id=user.id,
        title="Future Meeting",
        due_at_utc=now + timedelta(hours=2),
        priority=PriorityEnum.med,
        status=TaskStatusEnum.pending,
    )
    db_session.add(task)
    db_session.commit()

    reminder = Reminder(
        task_id=task.id,
        remind_at_utc=task.due_at_utc,
        channel="telegram",
        sent=False,
    )
    db_session.add(reminder)
    db_session.commit()

    dispatcher = MockDispatcher()
    count = process_due_reminders(db=db_session, dispatcher=dispatcher)
    assert count == 0
    assert len(dispatcher.dispatched) == 0

    db_session.refresh(reminder)
    assert reminder.sent is False


def test_completed_task_reminder_skipped(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)

    # Task is already done
    task = Task(
        user_id=user.id,
        title="Already finished task",
        due_at_utc=now - timedelta(minutes=5),
        status=TaskStatusEnum.done,
        completed_at=now - timedelta(minutes=10),
    )
    db_session.add(task)
    db_session.commit()

    reminder = Reminder(
        task_id=task.id,
        remind_at_utc=task.due_at_utc,
        channel="telegram",
        sent=False,
    )
    db_session.add(reminder)
    db_session.commit()

    dispatcher = MockDispatcher()
    count = process_due_reminders(db=db_session, dispatcher=dispatcher)
    # Should not send notification for already completed task
    assert count == 0
    assert len(dispatcher.dispatched) == 0

    db_session.refresh(reminder)
    assert reminder.sent is True  # marked sent so it doesn't get queried again


def test_sync_task_reminder(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)

    task = Task(
        user_id=user.id,
        title="Sync task",
        due_at_utc=now + timedelta(hours=1),
        status=TaskStatusEnum.pending,
    )
    db_session.add(task)
    db_session.commit()

    # Initial sync
    rem1 = sync_task_reminder(db_session, task)
    assert rem1 is not None
    assert rem1.remind_at_utc == task.due_at_utc
    assert rem1.sent is False

    # Update task due date and re-sync
    new_due = now + timedelta(hours=3)
    task.due_at_utc = new_due
    rem2 = sync_task_reminder(db_session, task)
    assert rem2.id == rem1.id
    assert rem2.remind_at_utc == new_due


def test_telegram_callback_done(db_session):
    user = db_session.query(User).first()
    task = Task(
        user_id=user.id,
        title="Telegram Action Task",
        status=TaskStatusEnum.pending,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    update = MagicMock()
    update.effective_user.id = int(user.telegram_chat_id or "123456789")
    update.effective_user.full_name = user.name
    update.callback_query.data = f"done:{task.id}"
    update.callback_query.answer = AsyncMock()
    update.callback_query.edit_message_text = AsyncMock()

    context = MagicMock()

    asyncio.run(handle_callback_query(update, context, db_override=db_session))

    # Verify task is completed
    db_session.refresh(task)
    assert task.status == TaskStatusEnum.done
    assert task.completed_at is not None
    update.callback_query.edit_message_text.assert_called_once()


def test_telegram_callback_snooze_1h(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)
    task = Task(
        user_id=user.id,
        title="Snooze Action Task",
        due_at_utc=now,
        status=TaskStatusEnum.pending,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    update = MagicMock()
    update.effective_user.id = int(user.telegram_chat_id or "123456789")
    update.effective_user.full_name = user.name
    update.callback_query.data = f"snooze_1h:{task.id}"
    update.callback_query.answer = AsyncMock()
    update.callback_query.edit_message_text = AsyncMock()

    context = MagicMock()

    asyncio.run(handle_callback_query(update, context, db_override=db_session))

    db_session.refresh(task)
    assert task.status == TaskStatusEnum.snoozed
    assert task.due_at_utc > now
    update.callback_query.edit_message_text.assert_called_once()


def test_telegram_callback_snooze_tomorrow(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)
    task = Task(
        user_id=user.id,
        title="Tomorrow Action Task",
        due_at_utc=now,
        status=TaskStatusEnum.pending,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    update = MagicMock()
    update.effective_user.id = int(user.telegram_chat_id or "123456789")
    update.effective_user.full_name = user.name
    update.callback_query.data = f"snooze_tomorrow:{task.id}"
    update.callback_query.answer = AsyncMock()
    update.callback_query.edit_message_text = AsyncMock()

    context = MagicMock()

    asyncio.run(handle_callback_query(update, context, db_override=db_session))

    db_session.refresh(task)
    assert task.status == TaskStatusEnum.snoozed
    assert task.due_at_utc > now
    update.callback_query.edit_message_text.assert_called_once()
