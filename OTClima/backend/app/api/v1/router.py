from fastapi import APIRouter
from app.api.v1.endpoints import auth, clients, work_orders, quotations, payments, evidences, technicians, reports, company

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(clients.router)
api_router.include_router(work_orders.router)
api_router.include_router(quotations.router)
api_router.include_router(payments.router)
api_router.include_router(evidences.router)
api_router.include_router(technicians.router)
api_router.include_router(reports.router)
api_router.include_router(company.router)
