from pydantic import BaseModel


class CompanyUpdate(BaseModel):
    name: str | None = None
    rut: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    quote_conditions: str | None = None
    quote_warranty: str | None = None


class CompanyOut(BaseModel):
    id: int
    name: str
    rut: str | None
    logo_path: str | None
    phone: str | None
    email: str | None
    address: str | None
    plan_type: str
    quote_conditions: str | None
    quote_warranty: str | None

    model_config = {"from_attributes": True}
