from sqlalchemy.orm import Session
from app.db.base import Client
from app.models.schemas import ClientCreate, ClientUpdate


def create_client(db: Session, data: ClientCreate, company_id: int | None) -> Client:
    client = Client(
        company_id=company_id,
        nombre=data.nombre.strip(),
        rut=data.rut.strip(),
        telefono=data.telefono.strip() if data.telefono else None,
        email=data.email.strip().lower() if data.email else None,
        direccion=data.direccion.strip() if data.direccion else None,
        notas=data.notas.strip() if data.notas else None,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def get_client(db: Session, client_id: int, company_id: int | None = None) -> Client | None:
    query = db.query(Client).filter(Client.id == client_id)
    if company_id is not None:
        query = query.filter(Client.company_id == company_id)
    return query.first()


def get_clients(db: Session, company_id: int | None = None) -> list[Client]:
    query = db.query(Client)
    if company_id is not None:
        query = query.filter(Client.company_id == company_id)
    return query.order_by(Client.nombre.asc()).all()


def update_client(db: Session, client: Client, data: ClientUpdate) -> Client:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(client, field, value.strip() if isinstance(value, str) else value)
        else:
            setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


def delete_client(db: Session, client: Client) -> None:
    db.delete(client)
    db.commit()
