from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func

from app.models.task import Task, PriorityEnum, TaskStatusEnum
from app.models.reminder import Reminder
from app.models.task_event import TaskEvent
from app.schemas.task import TaskCreate, TaskUpdate, TaskSnooze, TaskSummaryResponse


def utcnow():
    return datetime.now(timezone.utc)


def log_task_event(
    db: Session,
    task_id: int,
    event: str,
    meta: Optional[Dict[str, Any]] = None,
    commit: bool = True
) -> TaskEvent:
    task_event = TaskEvent(
        task_id=task_id,
        event=event,
        meta_json=meta,
        created_at=utcnow(),
    )
    db.add(task_event)
    if commit:
        db.commit()
    return task_event


def get_task(db: Session, task_id: int, user_id: Optional[int] = None) -> Optional[Task]:
    query = (
        db.query(Task)
        .options(joinedload(Task.reminders), joinedload(Task.events))
        .filter(Task.id == task_id)
    )
    if user_id is not None:
        query = query.filter(Task.user_id == user_id)
    return query.first()


def get_tasks(
    db: Session,
    user_id: Optional[int] = None,
    status: Optional[TaskStatusEnum] = None,
    priority: Optional[PriorityEnum] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    due_after: Optional[datetime] = None,
    due_before: Optional[datetime] = None,
    offset: int = 0,
    limit: int = 50,
) -> Tuple[List[Task], int]:
    query = db.query(Task)

    if user_id is not None:
        query = query.filter(Task.user_id == user_id)

    if status is not None:
        query = query.filter(Task.status == status)

    if priority is not None:
        query = query.filter(Task.priority == priority)

    if category is not None:
        query = query.filter(func.lower(Task.category) == category.lower())

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Task.title.ilike(search_filter),
                Task.description.ilike(search_filter),
                Task.category.ilike(search_filter),
            )
        )

    if due_after is not None:
        query = query.filter(Task.due_at_utc >= due_after)

    if due_before is not None:
        query = query.filter(Task.due_at_utc <= due_before)

    total = query.count()

    # Order by due_at_utc ascending (nulls last), then priority desc, then id desc
    tasks = (
        query.order_by(
            Task.due_at_utc.is_(None),
            Task.due_at_utc.asc(),
            Task.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return tasks, total


def create_task(db: Session, task_in: TaskCreate) -> Task:
    db_task = Task(
        user_id=task_in.user_id,
        title=task_in.title,
        description=task_in.description,
        due_at_utc=task_in.due_at_utc,
        priority=task_in.priority,
        category=task_in.category,
        recurrence_rule=task_in.recurrence_rule,
        estimated_minutes=task_in.estimated_minutes,
        status=TaskStatusEnum.pending,
        created_at=utcnow(),
    )
    db.add(db_task)
    db.flush()

    # Create default reminder if remind_at_utc is specified or matches due_at_utc
    remind_time = task_in.remind_at_utc or task_in.due_at_utc
    if remind_time:
        reminder = Reminder(
            task_id=db_task.id,
            remind_at_utc=remind_time,
            channel="telegram",
            sent=False,
            attempt_no=0,
        )
        db.add(reminder)

    log_task_event(
        db,
        task_id=db_task.id,
        event="created",
        meta={"title": db_task.title, "priority": db_task.priority.value if hasattr(db_task.priority, 'value') else db_task.priority},
        commit=False,
    )

    db.commit()
    db.refresh(db_task)
    return db_task


def update_task(db: Session, db_task: Task, task_in: TaskUpdate) -> Task:
    update_data = task_in.model_dump(exclude_unset=True)
    meta_changes = {}

    for field, value in update_data.items():
        old_val = getattr(db_task, field)
        if old_val != value:
            meta_changes[field] = {
                "old": str(old_val),
                "new": str(value)
            }
            setattr(db_task, field, value)

    # Status transition handlers
    if "status" in update_data:
        if task_in.status == TaskStatusEnum.done:
            db_task.completed_at = utcnow()
        elif task_in.status != TaskStatusEnum.done and db_task.completed_at is not None:
            db_task.completed_at = None

    if meta_changes:
        log_task_event(
            db,
            task_id=db_task.id,
            event="updated",
            meta={"changes": meta_changes},
            commit=False,
        )

    db.commit()
    db.refresh(db_task)
    return db_task


def complete_task(db: Session, db_task: Task) -> Task:
    db_task.status = TaskStatusEnum.done
    db_task.completed_at = utcnow()

    log_task_event(
        db,
        task_id=db_task.id,
        event="completed",
        meta={"completed_at": db_task.completed_at.isoformat()},
        commit=False,
    )

    db.commit()
    db.refresh(db_task)

    # Auto-spawn next recurring task instance if applicable
    if db_task.recurrence_rule:
        try:
            from app.smart.recurrence import spawn_recurring_task
            spawn_recurring_task(db, db_task)
        except Exception:
            pass

    return db_task


def snooze_task(db: Session, db_task: Task, snooze_in: TaskSnooze) -> Task:
    now = utcnow()
    new_due: datetime

    if snooze_in.snooze_until:
        new_due = snooze_in.snooze_until
    elif snooze_in.snooze_minutes:
        base_time = db_task.due_at_utc if (db_task.due_at_utc and db_task.due_at_utc > now) else now
        new_due = base_time + timedelta(minutes=snooze_in.snooze_minutes)
    else:
        base_time = db_task.due_at_utc if (db_task.due_at_utc and db_task.due_at_utc > now) else now
        new_due = base_time + timedelta(hours=1)

    db_task.due_at_utc = new_due
    db_task.status = TaskStatusEnum.snoozed

    # Add or update reminder
    reminder = db.query(Reminder).filter(Reminder.task_id == db_task.id, Reminder.sent == False).first()
    if reminder:
        reminder.remind_at_utc = new_due
        reminder.attempt_no = 0
    else:
        new_reminder = Reminder(
            task_id=db_task.id,
            remind_at_utc=new_due,
            channel="telegram",
            sent=False,
            attempt_no=0,
        )
        db.add(new_reminder)

    log_task_event(
        db,
        task_id=db_task.id,
        event="snoozed",
        meta={"new_due_at": new_due.isoformat()},
        commit=False,
    )

    db.commit()
    db.refresh(db_task)
    return db_task


def delete_task(db: Session, db_task: Task) -> bool:
    db.delete(db_task)
    db.commit()
    return True


def get_task_summary(db: Session, user_id: Optional[int] = None) -> TaskSummaryResponse:
    query = db.query(Task)
    if user_id is not None:
        query = query.filter(Task.user_id == user_id)

    tasks = query.all()
    now = utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    total = len(tasks)
    pending = sum(1 for t in tasks if t.status == TaskStatusEnum.pending)
    done = sum(1 for t in tasks if t.status == TaskStatusEnum.done)
    snoozed = sum(1 for t in tasks if t.status == TaskStatusEnum.snoozed)
    cancelled = sum(1 for t in tasks if t.status == TaskStatusEnum.cancelled)
    high_priority = sum(1 for t in tasks if t.priority == PriorityEnum.high and t.status in (TaskStatusEnum.pending, TaskStatusEnum.snoozed))
    overdue = sum(1 for t in tasks if t.due_at_utc and t.due_at_utc < now and t.status in (TaskStatusEnum.pending, TaskStatusEnum.snoozed))
    due_today = sum(1 for t in tasks if t.due_at_utc and today_start <= t.due_at_utc < today_end and t.status in (TaskStatusEnum.pending, TaskStatusEnum.snoozed))

    return TaskSummaryResponse(
        total=total,
        pending=pending,
        done=done,
        snoozed=snoozed,
        cancelled=cancelled,
        high_priority=high_priority,
        overdue=overdue,
        due_today=due_today,
    )
