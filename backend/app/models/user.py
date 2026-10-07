from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import UTCDateTime


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    telegram_chat_id = Column(String(100), nullable=True, index=True)
    timezone = Column(String(50), nullable=False, default="UTC")
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)

    # 2FA / Google Authenticator Fields
    totp_secret = Column(String(64), nullable=True)
    is_totp_enabled = Column(Boolean, nullable=False, default=False)
    backup_codes = Column(Text, nullable=True)

    # Onboarding Status
    has_completed_onboarding = Column(Boolean, nullable=False, default=False)

    # Relationships
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}', 2fa={self.is_totp_enabled})>"
