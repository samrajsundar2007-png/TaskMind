from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_telegram_chat_id(db: Session, chat_id: str) -> Optional[User]:
    return db.query(User).filter(User.telegram_chat_id == chat_id).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()


def create_user(db: Session, user_in: UserCreate) -> User:
    db_user = User(
        name=user_in.name,
        telegram_chat_id=user_in.telegram_chat_id,
        timezone=user_in.timezone or "UTC",
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, db_user: User, user_in: UserUpdate) -> User:
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_or_create_default_user(db: Session) -> User:
    user = db.query(User).first()
    if not user:
        user = User(name="Default User", timezone="UTC")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
