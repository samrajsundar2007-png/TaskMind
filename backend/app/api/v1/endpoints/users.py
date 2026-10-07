from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserCreate, UserUpdate, UserRead
from app.crud import user as crud_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
def get_current_user_profile(db: Session = Depends(get_db)):
    """Returns the default/active user profile for initial development."""
    return crud_user.get_or_create_default_user(db)


@router.get("/", response_model=List[UserRead])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_user.get_users(db, skip=skip, limit=limit)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_new_user(user_in: UserCreate, db: Session = Depends(get_db)):
    return crud_user.create_user(db, user_in)


@router.get("/{user_id}", response_model=UserRead)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    user = crud_user.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user_by_id(user_id: int, user_in: UserUpdate, db: Session = Depends(get_db)):
    user = crud_user.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
    return crud_user.update_user(db, db_user=user, user_in=user_in)
