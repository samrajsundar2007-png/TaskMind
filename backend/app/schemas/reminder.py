from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReminderBase(BaseModel):
    task_id: int
    remind_at_utc: datetime
    channel: str = Field("telegram", max_length=50)


class ReminderCreate(BaseModel):
    remind_at_utc: datetime
    channel: str = Field("telegram", max_length=50)


class ReminderRead(ReminderBase):
    id: int
    sent: bool
    attempt_no: int

    model_config = ConfigDict(from_attributes=True)
