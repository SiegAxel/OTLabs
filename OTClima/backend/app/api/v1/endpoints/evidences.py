import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.work_order import WorkOrder
from app.models.evidence import Evidence
from app.models.user import User
from app.api.deps import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/work-orders", tags=["evidences"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.get("/{ot_id}/evidences")
def list_evidences(ot_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ot = db.query(WorkOrder).filter(WorkOrder.id == ot_id, WorkOrder.company_id == current_user.company_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    return [
        {
            "id": e.id,
            "description": e.description,
            "stage": e.stage,
            "uploaded_at": e.uploaded_at,
            "url": f"/api/v1/evidences/{e.id}/file",
        }
        for e in ot.evidences
    ]


@router.post("/{ot_id}/evidences", status_code=201)
async def upload_evidence(
    ot_id: int,
    file: UploadFile = File(...),
    description: str = Form(""),
    stage: str = Form("execution"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ot = db.query(WorkOrder).filter(WorkOrder.id == ot_id, WorkOrder.company_id == current_user.company_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido")

    ext = Path(file.filename or "img.jpg").suffix
    filename = f"{uuid.uuid4()}{ext}"
    save_dir = settings.upload_path / "evidences"
    save_dir.mkdir(parents=True, exist_ok=True)
    file_path = save_dir / filename

    content = await file.read()
    file_path.write_bytes(content)

    ev = Evidence(
        work_order_id=ot_id,
        file_path=str(file_path),
        description=description,
        stage=stage,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return {"id": ev.id, "url": f"/api/v1/evidences/{ev.id}/file"}


@router.get("/evidences/{evidence_id}/file")
def get_evidence_file(evidence_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ev = db.get(Evidence, evidence_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    return FileResponse(ev.file_path)


@router.delete("/evidences/{evidence_id}", status_code=204)
def delete_evidence(evidence_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ev = db.get(Evidence, evidence_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    Path(ev.file_path).unlink(missing_ok=True)
    db.delete(ev)
    db.commit()
