from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, ConfigDict, Field


class HelloResponse(BaseModel):
    message: str


class LoginRequest(BaseModel):
    username: str  # Can be username or email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    username: str
    email: str
    is_active: bool = True
    is_verified: bool = False
    account_type: str = "independent"
    account_status: str = "approved"
    company_id: int | None = None
    company: str | None = None
    worker_range: str | None = None
    primary_role: str | None = None
    permissions: list[str] = Field(default_factory=list)


class UserInDB(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    username: str
    email: str
    hashed_password: str
    is_active: bool = True
    token_version: int = 1


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class VerifyEmailRequest(BaseModel):
    token: str | None = None
    code: str | None = None


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class PermissionResponse(BaseModel):
    code: str
    description: str | None = None


class RoleResponse(BaseModel):
    name: str
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)


class UserPermissionsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    company_id: int | None = None
    company: str | None = None
    is_active: bool
    is_verified: bool
    primary_role: str | None = None
    direct_permissions: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class SetUserRoleRequest(BaseModel):
    role_name: str


class AddUserPermissionRequest(BaseModel):
    permission_code: str


class RegisterProfile(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    city_commune: str | None = None
    business_name: str | None = None
    company_tax_id: str | None = None
    company_phone: str | None = None
    company_email: EmailStr | None = None
    address: str | None = None


class RegisterRequest(BaseModel):
    account_type: Literal["independent", "company"]
    email: EmailStr
    password: str
    terms_accepted: bool = False
    profile: RegisterProfile
    worker_range: Literal["1-5", "6-20", "21-50", "51-200", "200+"] | None = None


class RegisterResponse(BaseModel):
    status: Literal["approved", "pending_approval"]
    message: str
    user_id: int


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    rut: str | None = None
    logo_path: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    plan_type: str = "basic"
    quote_conditions: str | None = None
    quote_warranty: str | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    rut: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    quote_conditions: str | None = None
    quote_warranty: str | None = None


class ClientCreate(BaseModel):
    company_id: int | None = None
    nombre: str
    rut: str
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    notas: str | None = None


class ClientUpdate(BaseModel):
    nombre: str | None = None
    rut: str | None = None
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    notas: str | None = None


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int | None = None
    nombre: str
    rut: str
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    notas: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TechnicianCreate(BaseModel):
    company_id: int | None = None
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str | None = None


class TechnicianUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6)
    phone: str | None = None
    is_active: bool | None = None


class TechnicianResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int | None = None
    name: str
    email: str
    phone: str | None = None
    role: Literal["technician"] = "technician"
    is_active: bool
    active_ots: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class QuotationItemCreate(BaseModel):
    description: str
    qty: float = 1
    unit_price: int = 0


class QuotationItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    qty: float
    unit_price: int


class QuotationCreate(BaseModel):
    items: list[QuotationItemCreate] = Field(default_factory=list)
    discount: int = 0
    conditions: str | None = None
    warranty: str | None = None
    validity_days: int = 15


class QuotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_order_id: int
    items: list[QuotationItemResponse] = Field(default_factory=list)
    subtotal: int
    discount: int
    total: int
    conditions: str | None = None
    warranty: str | None = None
    validity_days: int
    sent_at: datetime | None = None
    created_at: datetime | None = None


class PaymentCreate(BaseModel):
    amount: int
    method: str
    notes: str | None = None


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_order_id: int
    amount: int
    method: str
    notes: str | None = None
    paid_at: datetime | None = None


class EvidenceUploadedByResponse(BaseModel):
    id: int
    name: str
    email: str


class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str | None = None
    stage: str
    uploaded_at: datetime | None = None
    url: str
    uploaded_by: EvidenceUploadedByResponse | None = None


class WorkOrderCreate(BaseModel):
    client_id: int
    technician_id: int | None = None
    title: str
    visit_type: Literal["free", "charged", "charged_deductible"] = "free"
    visit_cost: int = 0
    diagnosis_notes: str | None = None
    equipment_info: str | None = None


class WorkOrderUpdate(BaseModel):
    client_id: int | None = None
    technician_id: int | None = None
    title: str | None = None
    status: Literal["diagnosis", "quotation_sent", "approved", "in_execution", "finished", "paid", "rejected"] | None = None
    visit_type: Literal["free", "charged", "charged_deductible"] | None = None
    visit_cost: int | None = None
    diagnosis_notes: str | None = None
    equipment_info: str | None = None


class WorkOrderTransitionRequest(BaseModel):
    status: Literal["diagnosis", "quotation_sent", "approved", "in_execution", "finished", "paid", "rejected"]


class WorkOrderStatusChangedByResponse(BaseModel):
    id: int
    name: str
    email: str


class WorkOrderStatusHistoryResponse(BaseModel):
    id: int
    from_status: str | None = None
    to_status: str
    created_at: datetime
    changed_by: WorkOrderStatusChangedByResponse


class WorkOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    client_id: int
    technician_id: int | None = None
    title: str
    status: str
    visit_type: str
    visit_cost: int
    diagnosis_notes: str | None = None
    equipment_info: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    client: ClientResponse | None = None
    technician: TechnicianResponse | None = None
    quotation: QuotationResponse | None = None
    payment: PaymentResponse | None = None
    status_history: list[WorkOrderStatusHistoryResponse] = Field(default_factory=list)
