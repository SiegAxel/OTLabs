from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.auth.deps import CurrentUser, require_permissions
from app.auth.workspace import get_company_scope, get_target_company_id
from app.db.connection import get_db
from app.db.base import Client
from app.models.schemas import ClientCreate, ClientUpdate, ClientResponse
from app.services.client_service import (
    create_client,
    get_client,
    get_clients,
    update_client,
    delete_client,
)

router = APIRouter()


@router.get("/", response_model=list[ClientResponse])
def list_clients(
    current_user: CurrentUser = Depends(require_permissions("clients.read")),
    db: Session = Depends(get_db),
):
    return get_clients(db, company_id=get_company_scope(current_user, db))


@router.get("/{client_id}", response_model=ClientResponse)
def get_client_by_id(
    client_id: int,
    current_user: CurrentUser = Depends(require_permissions("clients.read")),
    db: Session = Depends(get_db),
):
    client = get_client(db, client_id, company_id=get_company_scope(current_user, db))
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_new_client(
    data: ClientCreate,
    current_user: CurrentUser = Depends(require_permissions("clients.create")),
    db: Session = Depends(get_db),
):
    company_id = get_target_company_id(current_user, db, data.company_id)
    existing = db.query(Client).filter(Client.company_id == company_id, Client.rut == data.rut.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A client with this RUT already exists",
        )
    return create_client(db, data, company_id=company_id)


@router.put("/{client_id}", response_model=ClientResponse)
def update_existing_client(
    client_id: int,
    data: ClientUpdate,
    current_user: CurrentUser = Depends(require_permissions("clients.update")),
    db: Session = Depends(get_db),
):
    company_scope = get_company_scope(current_user, db)
    client = get_client(db, client_id, company_id=company_scope)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    if data.rut is not None:
        duplicate = db.query(Client).filter(
            Client.company_id == client.company_id,
            Client.rut == data.rut.strip(),
            Client.id != client_id,
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A client with this RUT already exists",
            )
    return update_client(db, client, data)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_client(
    client_id: int,
    current_user: CurrentUser = Depends(require_permissions("clients.delete")),
    db: Session = Depends(get_db),
):
    client = get_client(db, client_id, company_id=get_company_scope(current_user, db))
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    delete_client(db, client)
