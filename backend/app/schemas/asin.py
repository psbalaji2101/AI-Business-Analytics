"""Pydantic schemas — the API contract."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    email: str


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
