from datetime import datetime
from pydantic import BaseModel
from app.schemas.client import ClientOut
from app.schemas.auth import UserOut


class WorkOrderBase(BaseModel):
    title: str
    client_id: int
    technician_id: int | None = None
    visit_type: str = "free"
    visit_cost: float = 0.0
    diagnosis_notes: str | None = None
    equipment_info: str | None = None


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderUpdate(BaseModel):
    title: str | None = None
    technician_id: int | None = None
    visit_type: str | None = None
    visit_cost: float | None = None
    diagnosis_notes: str | None = None
    equipment_info: str | None = None


class WorkOrderTransition(BaseModel):
    new_status: str


class WorkOrderOut(WorkOrderBase):
    id: int
    company_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    client: ClientOut | None = None
    technician: UserOut | None = None

    model_config = {"from_attributes": True}
