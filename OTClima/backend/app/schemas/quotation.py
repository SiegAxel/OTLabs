from datetime import datetime
from pydantic import BaseModel


class QuotationItem(BaseModel):
    description: str
    qty: float = 1.0
    unit_price: float


class QuotationBase(BaseModel):
    items: list[QuotationItem] = []
    discount: float = 0.0
    conditions: str | None = None
    warranty: str | None = None
    validity_days: int = 15


class QuotationCreate(QuotationBase):
    pass


class QuotationUpdate(QuotationBase):
    pass


class QuotationOut(QuotationBase):
    id: int
    work_order_id: int
    subtotal: float
    total: float
    sent_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
