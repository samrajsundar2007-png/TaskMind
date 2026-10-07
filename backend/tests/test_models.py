from datetime import datetime, timezone, timedelta
from app.models import User, Task, Reminder, TaskEvent, PriorityEnum, TaskStatusEnum


def test_user_creation_and_relations(db_session):
    user = User(name="Alice", telegram_chat_id="987654", timezone="America/New_York")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.id is not None
    assert user.name == "Alice"
    assert user.timezone == "America/New_York"
    assert user.created_at is not None


def test_task_lifecycle_and_cascades(db_session):
    user = db_session.query(User).first()
    due_time = datetime.now(timezone.utc) + timedelta(days=1)

    task = Task(
        user_id=user.id,
        title="Prepare presentation",
        description="Slides for quarterly review",
        due_at_utc=due_time,
        priority=PriorityEnum.high,
        category="Work",
        status=TaskStatusEnum.pending,
        estimated_minutes=45,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    assert task.id is not None
    assert task.status == TaskStatusEnum.pending
    assert task.priority == PriorityEnum.high

    # Add Reminder
    reminder = Reminder(
        task_id=task.id,
        remind_at_utc=due_time,
        channel="telegram",
    )
    db_session.add(reminder)

    # Add Event
    event = TaskEvent(
        task_id=task.id,
        event="created",
        meta_json={"source": "pytest"},
    )
    db_session.add(event)
    db_session.commit()

    db_session.refresh(task)
    assert len(task.reminders) == 1
    assert len(task.events) == 1
    assert task.reminders[0].remind_at_utc == due_time
    assert task.events[0].meta_json == {"source": "pytest"}

    # Test cascade deletion
    db_session.delete(task)
    db_session.commit()

    assert db_session.query(Reminder).filter(Reminder.task_id == task.id).count() == 0
    assert db_session.query(TaskEvent).filter(TaskEvent.task_id == task.id).count() == 0
