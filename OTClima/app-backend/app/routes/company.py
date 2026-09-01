from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.deps import CurrentUser, get_current_user, require_permissions
from app.db.connection import get_db
from app.models.schemas import CompanyResponse, CompanyUpdate
from app.services.company_service import company_response, get_user_company, update_company


router = APIRouter()

LOGO_DIR = Path(__file__).resolve().parents[1] / "static" / "company-logos"
MAX_LOGO_SIZE = 2 * 1024 * 1024
ALLOWED_LOGO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
}


def _logo_public_path(filename: str) -> str:
    return f"/api/v1/company-logos/{filename}"


@router.get("/company", response_model=CompanyResponse)
@router.get("/companies/me", response_model=CompanyResponse)
def get_company(
    current_user: CurrentUser = Depends(require_permissions("auth.me.read")),
    db: Session = Depends(get_db),
):
    return company_response(get_user_company(db, current_user.user_id))


@router.put("/company", response_model=CompanyResponse)
@router.put("/companies/me", response_model=CompanyResponse)
def update_current_company(
    data: CompanyUpdate,
    current_user: CurrentUser = Depends(require_permissions("users.manage")),
    db: Session = Depends(get_db),
):
    company = get_user_company(db, current_user.user_id)
    return company_response(update_company(db, company, data))


@router.post("/company/logo", response_model=CompanyResponse)
@router.post("/companies/me/logo", response_model=CompanyResponse)
async def upload_company_logo(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_permissions("users.manage")),
    db: Session = Depends(get_db),
):
    content_type = file.content_type or ""
    extension = ALLOWED_LOGO_TYPES.get(content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Logo must be PNG, JPG, SVG, or WEBP",
        )

    content = await file.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Logo must be 2MB or smaller",
        )

    company = get_user_company(db, current_user.user_id)
    LOGO_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"company-{company.id}-{uuid4().hex}{extension}"
    path = LOGO_DIR / filename
    path.write_bytes(content)

    company.logo_path = _logo_public_path(filename)
    db.commit()
    db.refresh(company)
    return company_response(company)


@router.get("/company-logos/{filename}")
def get_company_logo(filename: str):
    if "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo not found")

    path = LOGO_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo not found")

    return FileResponse(path)
