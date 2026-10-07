from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import UTCDateTime


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    remind_at_utc = Column(UTCDateTime, nullable=False, index=True)
    channel = Column(String(50), nullable=False, default="telegram")
    sent = Column(Boolean, nullable=False, default=False, index=True)
    attempt_no = Column(Integer, nullable=False, default=0)

    # Relationships
    task = relationship("Task", back_populates="reminders")

    def __repr__(self):
        return f"<Reminder(id={self.id}, task_id={self.task_id}, remind_at_utc='{self.remind_at_utc}', sent={self.sent})>"
