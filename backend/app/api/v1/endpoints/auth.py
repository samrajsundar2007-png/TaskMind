from datetime import timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.crud import user as crud_user
from app.schemas.user import (
    UserRead,
    UserCreate,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
    TwoFactorEnableResponse,
    TwoFactorDisableRequest,
    LoginRequest,
    LoginResponse,
)
from app.auth.security import create_access_token, get_current_user
from app.auth import totp as totp_util

router = APIRouter(prefix="/auth", tags=["Authentication & 2FA"])


class TwoFactorLoginRequest(BaseModel):
    user_id: int
    code: str = Field(..., min_length=4, max_length=16, description="6-digit TOTP code or backup recovery code")


@router.post("/login", response_model=LoginResponse)
def login_or_guest(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Logs in an existing user by name or registers if not found.
    If 2FA (Google Authenticator) is enabled, returns requires_2fa=True.
    """
    user = db.query(User).filter(User.name == payload.name).first()
    if not user:
        user = crud_user.create_user(
            db,
            user_in=UserCreate(
                name=payload.name,
                timezone=payload.timezone or "UTC",
                telegram_chat_id=payload.telegram_chat_id,
            ),
        )
    elif payload.timezone and user.timezone != payload.timezone:
        user.timezone = payload.timezone
        db.commit()
        db.refresh(user)

    # If 2FA is enabled, prompt for TOTP code
    if user.is_totp_enabled and user.totp_secret:
        pre_auth_token = create_access_token(
            {"sub": str(user.id), "name": user.name, "scope": "2fa_pending"},
            expires_delta=timedelta(minutes=10),
        )
        return LoginResponse(
            requires_2fa=True,
            pre_auth_token=pre_auth_token,
            user=UserRead.model_validate(user),
        )

    # Standard login
    token = create_access_token({"sub": str(user.id), "name": user.name})
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        requires_2fa=False,
        user=UserRead.model_validate(user),
    )


@router.post("/2fa/verify-login", response_model=LoginResponse)
def verify_2fa_login(
    payload: TwoFactorLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Verify 6-digit Google Authenticator TOTP code or backup code to complete login.
    """
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user or not user.is_totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not configured for this user.",
        )

    # 1. Check TOTP Code
    is_valid = totp_util.verify_totp_code(user.totp_secret, payload.code)

    # 2. Check Backup Recovery Codes if TOTP failed
    if not is_valid and user.backup_codes:
        backup_valid, updated_backup_codes = totp_util.verify_and_consume_backup_code(
            user.backup_codes,
            payload.code,
        )
        if backup_valid:
            is_valid = True
            user.backup_codes = updated_backup_codes
            db.commit()

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code or backup code. Please try again.",
        )

    # Issue full JWT token
    token = create_access_token({"sub": str(user.id), "name": user.name})
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        requires_2fa=False,
        user=UserRead.model_validate(user),
    )


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates a provisional TOTP secret and QR code for Google Authenticator.
    Must be confirmed with /2fa/enable.
    """
    secret = totp_util.generate_totp_secret()
    current_user.totp_secret = secret
    db.commit()
    db.refresh(current_user)

    uri = totp_util.get_totp_uri(
        secret=secret,
        user_name=current_user.name,
        issuer="TaskMind AI",
    )
    qr_base64 = totp_util.generate_qr_code_base64(uri)

    return TwoFactorSetupResponse(
        secret=secret,
        otpauth_uri=uri,
        qr_code_base64=qr_base64,
    )


@router.post("/2fa/enable", response_model=TwoFactorEnableResponse)
def enable_2fa(
    payload: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify the first 6-digit TOTP code and permanently enable 2FA for the account.
    Returns 8 single-use emergency backup recovery codes.
    """
    if current_user.id != payload.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please initiate 2FA setup first.",
        )

    is_valid = totp_util.verify_totp_code(current_user.totp_secret, payload.code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit code. Please verify time synchronization on your device.",
        )

    # Generate 8 backup recovery codes
    plain_backup_codes, hashed_json = totp_util.generate_backup_codes(count=8)
    current_user.is_totp_enabled = True
    current_user.backup_codes = hashed_json
    db.commit()
    db.refresh(current_user)

    return TwoFactorEnableResponse(
        success=True,
        message="Two-Factor Authentication (Google Authenticator) enabled successfully!",
        backup_codes=plain_backup_codes,
    )


@router.post("/2fa/disable")
def disable_2fa(
    payload: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Disable Two-Factor Authentication after verifying 6-digit code.
    """
    if current_user.id != payload.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    if not current_user.is_totp_enabled or not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not currently enabled on this account.",
        )

    is_valid = totp_util.verify_totp_code(current_user.totp_secret, payload.code)
    if not is_valid and current_user.backup_codes:
        backup_valid, updated_codes = totp_util.verify_and_consume_backup_code(
            current_user.backup_codes,
            payload.code,
        )
        if backup_valid:
            is_valid = True

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code. Cannot disable 2FA without valid verification.",
        )

    current_user.is_totp_enabled = False
    current_user.totp_secret = None
    current_user.backup_codes = None
    db.commit()

    return {"success": True, "message": "Two-Factor Authentication disabled successfully."}


@router.get("/me", response_model=UserRead)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Returns profile for currently authenticated user."""
    return current_user
