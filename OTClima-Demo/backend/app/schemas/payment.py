from datetime import datetime
from pydantic import BaseModel


class PaymentCreate(BaseModel):
    amount: float
    method: str = "transfer"
    notes: str | None = None


class PaymentOut(PaymentCreate):
    id: int
    work_order_id: int
    paid_at: datetime

    model_config = {"from_attributes": True}
