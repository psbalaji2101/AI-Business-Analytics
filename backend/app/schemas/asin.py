"""Pydantic schemas — the API contract."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    email: str
    created_at: datetime | None = None
    last_login_at: datetime | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    token: str
    user: UserOut


# ---------- ASIN ----------
class AsinBase(BaseModel):
    asin: str
    product_name: str
    category: str | None = None
    sub_category: str | None = None
    is_active: bool = True


class AsinCreate(AsinBase):
    pass


class AsinUpdate(BaseModel):
    product_name: str | None = None
    category: str | None = None
    sub_category: str | None = None
    is_active: bool | None = None


class TrackingUpdate(BaseModel):
    is_active: bool


class AsinOut(AsinBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_deleted: bool
    name_is_custom: bool = False
    date_added: datetime
    last_scraped_at: datetime | None = None


class PaginatedAsins(BaseModel):
    items: list[AsinOut]
    total: int
    page: int
    page_size: int


class BulkUploadResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]
