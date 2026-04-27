import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyUpdate, CompanyOut
from app.api.deps import get_current_user, require_admin
from app.core.config import settings

router = APIRouter(prefix="/company", tags=["company"])


@router.get("", response_model=CompanyOut)
def get_company(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company = db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


@router.put("", response_model=CompanyOut)
def update_company(
    body: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    company = db.get(Company, current_user.company_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return company


@router.post("/logo", response_model=CompanyOut)
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Tipo de imagen no permitido")

    ext = Path(file.filename or "logo.png").suffix
    filename = f"logo_{current_user.company_id}{ext}"
    save_dir = settings.upload_path / "logos"
    save_dir.mkdir(parents=True, exist_ok=True)
    file_path = save_dir / filename

    content = await file.read()
    file_path.write_bytes(content)

    company = db.get(Company, current_user.company_id)
    company.logo_path = str(file_path)
    db.commit()
    db.refresh(company)
    return company
