from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import UTCDateTime


def utcnow():
    return datetime.now(timezone.utc)


class TaskEvent(Base):
    __tablename__ = "task_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    event = Column(String(50), nullable=False)  # 'created', 'updated', 'completed', 'snoozed', 'cancelled', 'deleted'
    meta_json = Column(JSON, nullable=True)
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)

    # Relationships
    task = relationship("Task", back_populates="events")

    def __repr__(self):
        return f"<TaskEvent(id={self.id}, task_id={self.task_id}, event='{self.event}', created_at='{self.created_at}')>"
