from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import PriorityEnum, TaskStatusEnum
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskSnooze,
    TaskRead,
    TaskDetailRead,
    TaskListResponse,
    TaskSummaryResponse,
)
from app.crud import task as crud_task
from app.crud import user as crud_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def parse_query_dt(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    cleaned = val.strip().replace(" ", "+")
    if cleaned.endswith("Z") or cleaned.endswith("z"):
        cleaned = cleaned[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid datetime format: '{val}'. Expected ISO format (e.g. 2026-10-08T12:00:00Z)",
        )


@router.get("/summary", response_model=TaskSummaryResponse)
def get_task_summary(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retrieve statistical summary of tasks (overdue, due today, by status/priority)."""
    return crud_task.get_task_summary(db, user_id=user_id)


@router.post("/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
):
    """Create a new task with optional reminder and event logging."""
    user = crud_user.get_user(db, user_id=task_in.user_id)
    if not user:
        user = crud_user.get_or_create_default_user(db)
        task_in.user_id = user.id

    return crud_task.create_task(db, task_in=task_in)


@router.get("/", response_model=TaskListResponse)
def list_tasks(
    user_id: Optional[int] = None,
    status: Optional[TaskStatusEnum] = None,
    priority: Optional[PriorityEnum] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    due_after: Optional[str] = Query(None, description="ISO datetime for lower bound"),
    due_before: Optional[str] = Query(None, description="ISO datetime for upper bound"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List tasks with comprehensive filtering, search, and pagination."""
    due_after_dt = parse_query_dt(due_after)
    due_before_dt = parse_query_dt(due_before)

    items, total = crud_task.get_tasks(
        db,
        user_id=user_id,
        status=status,
        priority=priority,
        category=category,
        search=search,
        due_after=due_after_dt,
        due_before=due_before_dt,
        offset=offset,
        limit=limit,
    )
    return TaskListResponse(
        total=total,
        items=items,
        limit=limit,
        offset=offset,
    )


@router.get("/{task_id}", response_model=TaskDetailRead)
def get_task_by_id(
    task_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve a single task with its reminders and event history."""
    task = crud_task.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )
    return task


@router.put("/{task_id}", response_model=TaskRead)
def update_task_by_id(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing task's fields and log changes."""
    task = crud_task.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )
    return crud_task.update_task(db, db_task=task, task_in=task_in)


@router.post("/{task_id}/complete", response_model=TaskRead)
def complete_task_by_id(
    task_id: int,
    db: Session = Depends(get_db),
):
    """Mark a task as completed."""
    task = crud_task.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )
    return crud_task.complete_task(db, db_task=task)


@router.post("/{task_id}/snooze", response_model=TaskRead)
def snooze_task_by_id(
    task_id: int,
    snooze_in: TaskSnooze,
    db: Session = Depends(get_db),
):
    """Snooze a task by a duration or until a specified datetime."""
    task = crud_task.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )
    return crud_task.snooze_task(db, db_task=task, snooze_in=snooze_in)


@router.delete("/{task_id}", status_code=status.HTTP_200_OK)
def delete_task_by_id(
    task_id: int,
    db: Session = Depends(get_db),
):
    """Delete a task and all associated reminders and events."""
    task = crud_task.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )
    crud_task.delete_task(db, db_task=task)
    return {
        "success": True,
        "message": f"Task {task_id} deleted successfully",
        "id": task_id,
    }
