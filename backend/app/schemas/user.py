from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    telegram_chat_id: Optional[str] = Field(None, max_length=100)
    timezone: str = Field("UTC", max_length=50)


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    telegram_chat_id: Optional[str] = Field(None, max_length=100)
    timezone: Optional[str] = Field(None, max_length=50)
    has_completed_onboarding: Optional[bool] = None


class UserRead(UserBase):
    id: int
    is_totp_enabled: bool = False
    has_completed_onboarding: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_code_base64: str


class TwoFactorVerifyRequest(BaseModel):
    user_id: int
    code: str = Field(..., min_length=6, max_length=12, description="6-digit TOTP code or backup code")


class TwoFactorEnableResponse(BaseModel):
    success: bool
    message: str
    backup_codes: List[str]


class TwoFactorDisableRequest(BaseModel):
    user_id: int
    code: str = Field(..., min_length=6, max_length=12)


class LoginRequest(BaseModel):
    name: str = Field(..., min_length=1)
    timezone: Optional[str] = None
    telegram_chat_id: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    requires_2fa: bool = False
    pre_auth_token: Optional[str] = None
    user: Optional[UserRead] = None
