import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import UTCDateTime


def utcnow():
    return datetime.now(timezone.utc)


class PriorityEnum(str, enum.Enum):
    low = "low"
    med = "med"
    high = "high"


class TaskStatusEnum(str, enum.Enum):
    pending = "pending"
    done = "done"
    snoozed = "snoozed"
    cancelled = "cancelled"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_at_utc = Column(UTCDateTime, nullable=True, index=True)
    priority = Column(Enum(PriorityEnum, name="task_priority", values_callable=lambda obj: [e.value for e in obj]), default=PriorityEnum.med, nullable=False)
    category = Column(String(100), nullable=True)
    status = Column(Enum(TaskStatusEnum, name="task_status", values_callable=lambda obj: [e.value for e in obj]), default=TaskStatusEnum.pending, nullable=False, index=True)
    recurrence_rule = Column(String(255), nullable=True)
    estimated_minutes = Column(Integer, nullable=True)
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)
    completed_at = Column(UTCDateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="tasks")
    reminders = relationship("Reminder", back_populates="task", cascade="all, delete-orphan")
    events = relationship("TaskEvent", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', status='{self.status}', priority='{self.priority}')>"
