"""ASIN router — full CRUD, search, filter, pagination, bulk CSV upload."""
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas.asin import (
    AsinCreate,
    AsinOut,
    AsinUpdate,
    BulkUploadResult,
    PaginatedAsins,
    TrackingUpdate,
)
from app.services.asin_service import AsinService
from app.services.snapshot_service import SnapshotService, scrape_all_active_bg

router = APIRouter(prefix="/asins", tags=["asins"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=PaginatedAsins)
async def list_asins(
    q: str | None = None,
    category: str | None = None,
    sub_category: str | None = None,
    active: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    sort: str = "-date_added",
    db: AsyncSession = Depends(get_db),
) -> PaginatedAsins:
    items, total = await AsinService(db).list(
        q=q,
        category=category,
        sub_category=sub_category,
        active=active,
        page=page,
        page_size=page_size,
        sort=sort,
    )
    return PaginatedAsins(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=AsinOut, status_code=status.HTTP_201_CREATED)
async def create_asin(payload: AsinCreate, db: AsyncSession = Depends(get_db)) -> AsinOut:
    service = AsinService(db)
    existing = await service.get_by_asin(payload.asin)
    if existing and not existing.is_deleted:
        raise HTTPException(status.HTTP_409_CONFLICT, f"ASIN {payload.asin} already exists.")

    obj = await service.revive(existing, payload) if existing else await service.create(payload)
    # Scrape the new product immediately so its data shows up right away (best-effort).
    await SnapshotService(db).scrape_and_save(obj)
    await db.refresh(obj)
    return obj


@router.get("/{asin_id}", response_model=AsinOut)
async def get_asin(asin_id: int, db: AsyncSession = Depends(get_db)) -> AsinOut:
    obj = await AsinService(db).get(asin_id)
    if not obj or obj.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ASIN not found")
    return obj


@router.put("/{asin_id}", response_model=AsinOut)
async def update_asin(
    asin_id: int, payload: AsinUpdate, db: AsyncSession = Depends(get_db)
) -> AsinOut:
    obj = await AsinService(db).update(asin_id, payload)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ASIN not found")
    return obj


@router.delete("/{asin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asin(asin_id: int, db: AsyncSession = Depends(get_db)) -> None:
    ok = await AsinService(db).delete(asin_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ASIN not found")


@router.patch("/{asin_id}/tracking", response_model=AsinOut)
async def set_tracking(
    asin_id: int, payload: TrackingUpdate, db: AsyncSession = Depends(get_db)
) -> AsinOut:
    obj = await AsinService(db).set_tracking(asin_id, payload.is_active)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ASIN not found")
    return obj


@router.post("/bulk-upload", response_model=BulkUploadResult)
async def bulk_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> BulkUploadResult:
    content = await file.read()
    result = await AsinService(db).bulk_upload(content)
    # Scrape all active ASINs (incl. the newly uploaded) in the background.
    if result.created:
        background_tasks.add_task(scrape_all_active_bg)
    return result
