from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.db.base import Company, User, WorkerRange
from app.models.schemas import CompanyResponse, CompanyUpdate


INDEPENDENT_COMPANY_NAME = "Independiente"

WORKER_RANGE_CODES: tuple[str, ...] = (
    "1-5",
    "6-20",
    "21-50",
    "51-200",
    "200+",
)

SAMPLE_COMPANIES: tuple[dict[str, str | bool], ...] = (
    {
        "name": INDEPENDENT_COMPANY_NAME,
        "tax_id": "",
        "email": "",
        "phone": "",
        "address": "",
        "is_independent": True,
    },
    {
        "name": "Constructora Andina SpA",
        "tax_id": "76.123.456-7",
        "email": "contacto@andina.example",
        "phone": "+56 2 2456 7800",
        "address": "Av. Apoquindo 4500, Las Condes",
        "is_independent": False,
    },
    {
        "name": "Servicios Tecnicos Sur Ltda",
        "tax_id": "77.987.654-3",
        "email": "operaciones@sur.example",
        "phone": "+56 41 312 4455",
        "address": "O'Higgins 120, Concepcion",
        "is_independent": False,
    },
    {
        "name": "Montajes Industriales Norte",
        "tax_id": "78.456.123-9",
        "email": "admin@norte.example",
        "phone": "+56 55 245 9900",
        "address": "Ruta 5 Norte Km 1380, Antofagasta",
        "is_independent": False,
    },
)


def bootstrap_companies_and_worker_ranges(db: Session) -> None:
    for code in WORKER_RANGE_CODES:
        worker_range = db.query(WorkerRange).filter(WorkerRange.code == code).first()
        if worker_range is None:
            db.add(WorkerRange(code=code, label=code))

    for seed in SAMPLE_COMPANIES:
        company = db.query(Company).filter(Company.name == str(seed["name"])).first()
        if company is None:
            company = Company(
                name=str(seed["name"]),
                tax_id=str(seed["tax_id"]) or None,
                email=str(seed["email"]) or None,
                phone=str(seed["phone"]) or None,
                address=str(seed["address"]) or None,
                is_independent=bool(seed["is_independent"]),
            )
            db.add(company)

    db.flush()

    independent_company = get_independent_company(db)
    if independent_company is not None:
        db.query(User).filter(User.company_id.is_(None)).update(
            {User.company_id: independent_company.id},
            synchronize_session=False,
        )

    db.commit()


def get_independent_company(db: Session) -> Company | None:
    return db.query(Company).filter(Company.is_independent.is_(True)).order_by(Company.id.asc()).first()


def get_worker_range_by_code(db: Session, code: str) -> WorkerRange | None:
    return db.query(WorkerRange).filter(WorkerRange.code == code).first()


def company_response(company: Company) -> CompanyResponse:
    return CompanyResponse(
        id=company.id,
        name=company.name,
        rut=company.tax_id,
        logo_path=company.logo_path,
        phone=company.phone,
        email=company.email,
        address=company.address,
        plan_type=company.plan_type,
        quote_conditions=company.quote_conditions,
        quote_warranty=company.quote_warranty,
    )


def get_user_company(db: Session, user_id: int) -> Company:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or user.company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company workspace not found",
        )
    return user.company


def update_company(db: Session, company: Company, data: CompanyUpdate) -> Company:
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        company.name = update_data["name"].strip()
    if "rut" in update_data:
        company.tax_id = update_data["rut"].strip() if update_data["rut"] else None
    if "phone" in update_data:
        company.phone = update_data["phone"].strip() if update_data["phone"] else None
    if "email" in update_data:
        company.email = str(update_data["email"]).strip().lower() if update_data["email"] else None
    if "address" in update_data:
        company.address = update_data["address"].strip() if update_data["address"] else None
    if "quote_conditions" in update_data:
        value = update_data["quote_conditions"]
        company.quote_conditions = value.strip() if value else None
    if "quote_warranty" in update_data:
        value = update_data["quote_warranty"]
        company.quote_warranty = value.strip() if value else None

    db.commit()
    db.refresh(company)
    return company
