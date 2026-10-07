from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.task import PriorityEnum, TaskStatusEnum
from app.schemas.reminder import ReminderRead
from app.schemas.task_event import TaskEventRead


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_at_utc: Optional[datetime] = None
    priority: PriorityEnum = PriorityEnum.med
    category: Optional[str] = Field(None, max_length=100)
    recurrence_rule: Optional[str] = Field(None, max_length=255)
    estimated_minutes: Optional[int] = Field(None, ge=1, le=1440)

    @field_validator("due_at_utc", mode="before")
    @classmethod
    def validate_due_at_utc(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        return ensure_utc(v)


class TaskCreate(TaskBase):
    user_id: int
    remind_at_utc: Optional[datetime] = None

    @field_validator("remind_at_utc", mode="before")
    @classmethod
    def validate_remind_at(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        return ensure_utc(v)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_at_utc: Optional[datetime] = None
    priority: Optional[PriorityEnum] = None
    category: Optional[str] = Field(None, max_length=100)
    status: Optional[TaskStatusEnum] = None
    recurrence_rule: Optional[str] = Field(None, max_length=255)
    estimated_minutes: Optional[int] = Field(None, ge=1, le=1440)

    @field_validator("due_at_utc", mode="before")
    @classmethod
    def validate_due_at(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        return ensure_utc(v)


class TaskSnooze(BaseModel):
    snooze_until: Optional[datetime] = None
    snooze_minutes: Optional[int] = Field(None, ge=1)

    @field_validator("snooze_until", mode="before")
    @classmethod
    def validate_snooze_until(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        return ensure_utc(v)


class TaskRead(TaskBase):
    id: int
    user_id: int
    status: TaskStatusEnum
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TaskDetailRead(TaskRead):
    reminders: List[ReminderRead] = []
    events: List[TaskEventRead] = []

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    total: int
    items: List[TaskRead]
    limit: int
    offset: int


class TaskSummaryResponse(BaseModel):
    total: int
    pending: int
    done: int
    snoozed: int
    cancelled: int
    high_priority: int
    overdue: int
    due_today: int
