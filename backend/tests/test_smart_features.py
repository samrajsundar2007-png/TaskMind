from datetime import datetime, timezone, timedelta
from app.models.user import User
from app.models.task import Task, PriorityEnum, TaskStatusEnum
from app.models.reminder import Reminder
from app.crud import task as crud_task
from app.smart.recurrence import normalize_rrule, compute_next_due_date, spawn_recurring_task
from app.smart.escalation import process_escalating_reminders
from app.smart.overload import analyze_daily_workload
from app.smart.briefing import generate_daily_briefing, generate_weekly_review
from app.notifications.dispatcher import NotificationDispatcher


class MockDispatcher(NotificationDispatcher):
    def __init__(self):
        super().__init__(bot_token="mock_token")
        self.dispatched = []

    def send_reminder(self, user: User, task: Task, reminder: Reminder) -> bool:
        self.dispatched.append({
            "task_id": task.id,
            "title": task.title,
            "attempt_no": reminder.attempt_no,
        })
        return True


def test_recurrence_normalization_and_calculation():
    # Test normalization
    assert normalize_rrule("daily") == "FREQ=DAILY"
    assert normalize_rrule("weekly") == "FREQ=WEEKLY"
    assert normalize_rrule("every weekday") == "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    assert normalize_rrule("every Monday") == "FREQ=WEEKLY;BYDAY=MO"

    # Test next due date computation
    base = datetime(2026, 10, 8, 9, 0, 0, tzinfo=timezone.utc)  # Thursday
    next_daily = compute_next_due_date("FREQ=DAILY", current_due_utc=base, base_time_utc=base)
    assert next_daily == datetime(2026, 10, 9, 9, 0, 0, tzinfo=timezone.utc)

    next_weekly = compute_next_due_date("FREQ=WEEKLY", current_due_utc=base, base_time_utc=base)
    assert next_weekly == datetime(2026, 10, 15, 9, 0, 0, tzinfo=timezone.utc)


def test_spawn_recurring_task_on_completion(db_session):
    user = db_session.query(User).first()
    start_due = datetime(2026, 10, 8, 10, 0, 0, tzinfo=timezone.utc)

    task = Task(
        user_id=user.id,
        title="Weekly Team Standup",
        due_at_utc=start_due,
        priority=PriorityEnum.high,
        category="Work",
        recurrence_rule="FREQ=WEEKLY",
        status=TaskStatusEnum.pending,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    # Complete the recurring task
    crud_task.complete_task(db_session, db_task=task)

    # Verify old task is completed
    db_session.refresh(task)
    assert task.status == TaskStatusEnum.done

    # Verify a new instance was automatically spawned
    all_tasks = db_session.query(Task).filter(Task.title == "Weekly Team Standup").all()
    assert len(all_tasks) == 2

    new_task = next(t for t in all_tasks if t.id != task.id)
    assert new_task.status == TaskStatusEnum.pending
    assert new_task.due_at_utc > task.due_at_utc
    assert new_task.recurrence_rule == "FREQ=WEEKLY"
    assert len(new_task.reminders) == 1


def test_escalating_reminders_for_urgent_tasks(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)

    # High priority task overdue by 30 mins
    task = Task(
        user_id=user.id,
        title="Critical Security Patch",
        due_at_utc=now - timedelta(minutes=30),
        priority=PriorityEnum.high,
        status=TaskStatusEnum.pending,
    )
    db_session.add(task)
    db_session.commit()

    dispatcher = MockDispatcher()
    count = process_escalating_reminders(
        db=db_session,
        dispatcher=dispatcher,
        max_escalations=3,
        escalation_interval_minutes=15,
    )

    assert count == 1
    assert len(dispatcher.dispatched) == 1
    assert dispatcher.dispatched[0]["task_id"] == task.id
    assert dispatcher.dispatched[0]["attempt_no"] == 1


def test_overload_workload_analysis(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)

    # Normal day (2 tasks, ~60 mins total)
    t1 = Task(user_id=user.id, title="Task 1", due_at_utc=now, estimated_minutes=30)
    t2 = Task(user_id=user.id, title="Task 2", due_at_utc=now, estimated_minutes=30)
    db_session.add_all([t1, t2])
    db_session.commit()

    analysis_normal = analyze_daily_workload(db_session, user=user, target_date=now)
    assert analysis_normal.is_overloaded is False

    # Heavy day (add tasks totaling > 360 mins)
    for i in range(3, 10):
        db_session.add(Task(
            user_id=user.id,
            title=f"Heavy Task {i}",
            due_at_utc=now,
            priority=PriorityEnum.high,
            estimated_minutes=60,
        ))
    db_session.commit()

    analysis_heavy = analyze_daily_workload(db_session, user=user, target_date=now)
    assert analysis_heavy.is_overloaded is True
    assert analysis_heavy.total_estimated_minutes > 360
    assert analysis_heavy.warning_message is not None
    assert len(analysis_heavy.suggested_actions) >= 1


def test_daily_briefing_and_weekly_review(db_session):
    user = db_session.query(User).first()
    now = datetime.now(timezone.utc)

    # 1 Overdue, 1 Today, 1 Completed
    db_session.add(Task(user_id=user.id, title="Overdue Task", due_at_utc=now - timedelta(days=1), priority=PriorityEnum.high))
    db_session.add(Task(user_id=user.id, title="Today Task", due_at_utc=now + timedelta(hours=2), priority=PriorityEnum.med))
    done_task = Task(user_id=user.id, title="Finished Task", due_at_utc=now - timedelta(days=2), status=TaskStatusEnum.done, completed_at=now - timedelta(days=2))
    db_session.add(done_task)
    db_session.commit()

    # Test Daily Briefing
    briefing = generate_daily_briefing(db_session, user=user)
    assert briefing["overdue_count"] >= 1
    assert briefing["today_count"] >= 1
    assert "Daily Briefing" in briefing["briefing_text"]

    # Test Weekly Review
    review = generate_weekly_review(db_session, user=user)
    assert review["total_completed"] >= 1
    assert review["on_time_rate"] > 0
    assert "Weekly Review" in review["review_text"]


def test_smart_api_endpoints(client):
    res_brief = client.get("/api/v1/smart/daily-briefing")
    assert res_brief.status_code == 200
    assert "briefing_text" in res_brief.json()

    res_review = client.get("/api/v1/smart/weekly-review")
    assert res_review.status_code == 200
    assert "total_completed" in res_review.json()

    res_workload = client.get("/api/v1/smart/workload")
    assert res_workload.status_code == 200
    assert "is_overloaded" in res_workload.json()
