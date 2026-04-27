from pydantic import BaseModel


class ClientBase(BaseModel):
    name: str
    rut: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    name: str | None = None


class ClientOut(ClientBase):
    id: int
    company_id: int

    model_config = {"from_attributes": True}
