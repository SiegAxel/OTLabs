from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.models.company import Company
from app.models.user import User
from app.models.client import Client
from app.models.work_order import WorkOrder
from app.models.quotation import Quotation
from app.models.payment import Payment


def init_db(db: Session) -> None:
    if db.query(Company).first():
        return

    company = Company(
        name="Clima & Confort SpA",
        rut="76.543.210-K",
        phone="+56 9 8765 4321",
        email="contacto@climaconfort.cl",
        address="Av. Providencia 1234, Santiago",
        plan_type="pro",
        quote_conditions="Precios incluyen IVA. Pago al contado o 50% anticipo. "
                         "Trabajos garantizados según lo acordado.",
        quote_warranty="90 días en mano de obra. Garantía de fábrica en equipos y repuestos.",
    )
    db.add(company)
    db.flush()

    admin = User(
        company_id=company.id,
        name="Felipe Rojas (Admin)",
        email="admin@otclima.cl",
        hashed_password=hash_password("demo1234"),
        role="admin",
    )
    tech1 = User(
        company_id=company.id,
        name="Carlos Muñoz",
        email="carlos@otclima.cl",
        hashed_password=hash_password("demo1234"),
        role="technician",
    )
    tech2 = User(
        company_id=company.id,
        name="Andrés Soto",
        email="andres@otclima.cl",
        hashed_password=hash_password("demo1234"),
        role="technician",
    )
    db.add_all([admin, tech1, tech2])
    db.flush()

    clients = [
        Client(company_id=company.id, name="Constructora Norte S.A.", rut="77.111.222-3",
               phone="+56 2 2345 6789", email="obras@cnorte.cl", address="Los Leones 456, Providencia"),
        Client(company_id=company.id, name="Hotel Costa Verde", rut="76.999.888-7",
               phone="+56 9 9876 5432", email="mantencion@costaverde.cl", address="Balmaceda 890, Valparaíso"),
        Client(company_id=company.id, name="Clínica San Lucas", rut="96.112.334-5",
               phone="+56 2 3456 7890", email="infraestructura@sanlucas.cl", address="Gran Avenida 2000, La Florida"),
        Client(company_id=company.id, name="Bodega Atacama Ltda.", rut="79.234.567-1",
               phone="+56 9 7654 3210", email="logistica@atacama.cl", address="Ruta 5 Norte Km 1300"),
    ]
    db.add_all(clients)
    db.flush()

    now = datetime.now(timezone.utc)

    ot1 = WorkOrder(
        company_id=company.id, client_id=clients[0].id, technician_id=tech1.id,
        title="Mantención preventiva central 4 equipos split",
        status="paid", visit_type="free", visit_cost=0,
        diagnosis_notes="Equipos con filtros saturados, gas R-410A al 80%. Se realizó limpieza completa y recarga.",
        equipment_info="4x Split 18.000 BTU Samsung",
        created_at=now - timedelta(days=30),
        updated_at=now - timedelta(days=25),
    )
    db.add(ot1)
    db.flush()
    q1 = Quotation(
        work_order_id=ot1.id,
        items=[
            {"description": "Limpieza completa split (x4)", "qty": 4, "unit_price": 25000},
            {"description": "Recarga gas R-410A (x2 equipos)", "qty": 2, "unit_price": 35000},
            {"description": "Filtros HEPA repuesto (x4)", "qty": 4, "unit_price": 8000},
        ],
        subtotal=202000, discount=0, total=202000,
        conditions=company.quote_conditions,
        warranty=company.quote_warranty,
        validity_days=15,
        sent_at=now - timedelta(days=28),
    )
    db.add(q1)
    db.flush()
    db.add(Payment(work_order_id=ot1.id, amount=202000, method="transfer",
                   paid_at=now - timedelta(days=25)))

    ot2 = WorkOrder(
        company_id=company.id, client_id=clients[1].id, technician_id=tech1.id,
        title="Instalación equipo VRV piso lobby",
        status="in_execution", visit_type="charged_deductible", visit_cost=15000,
        diagnosis_notes="Requiere instalación de equipo VRV 36.000 BTU. Ductos en mal estado, requieren reemplazo.",
        equipment_info="VRV Daikin 36.000 BTU",
        created_at=now - timedelta(days=10),
        updated_at=now - timedelta(days=3),
    )
    db.add(ot2)
    db.flush()
    q2 = Quotation(
        work_order_id=ot2.id,
        items=[
            {"description": "Equipo VRV Daikin 36.000 BTU", "qty": 1, "unit_price": 850000},
            {"description": "Instalación y puesta en marcha", "qty": 1, "unit_price": 120000},
            {"description": "Ductos galvanizados 100mm (ml)", "qty": 8, "unit_price": 18000},
            {"description": "Mano de obra instalación ductos", "qty": 1, "unit_price": 60000},
        ],
        subtotal=1174000, discount=15000, total=1159000,
        conditions=company.quote_conditions,
        warranty="6 meses mano de obra, garantía de fábrica equipos.",
        validity_days=20,
        sent_at=now - timedelta(days=8),
    )
    db.add(q2)

    ot3 = WorkOrder(
        company_id=company.id, client_id=clients[2].id, technician_id=tech2.id,
        title="Revisión falla compresor quirófano 2",
        status="quotation_sent", visit_type="charged", visit_cost=20000,
        diagnosis_notes="Compresor unidad exterior presenta ruido anormal y baja presión. "
                        "Posible falla de capacitor de arranque. Se recomienda reemplazo preventivo.",
        equipment_info="Carrier 24.000 BTU inverter",
        created_at=now - timedelta(days=5),
        updated_at=now - timedelta(days=4),
    )
    db.add(ot3)
    db.flush()
    q3 = Quotation(
        work_order_id=ot3.id,
        items=[
            {"description": "Capacitor arranque compresor", "qty": 1, "unit_price": 18000},
            {"description": "Mano de obra diagnóstico y reemplazo", "qty": 1, "unit_price": 45000},
        ],
        subtotal=63000, discount=0, total=63000,
        conditions=company.quote_conditions,
        warranty=company.quote_warranty,
        validity_days=10,
        sent_at=now - timedelta(days=4),
    )
    db.add(q3)

    ot4 = WorkOrder(
        company_id=company.id, client_id=clients[3].id, technician_id=tech2.id,
        title="Diagnóstico sistema central bodega",
        status="diagnosis", visit_type="free", visit_cost=0,
        diagnosis_notes="",
        equipment_info="Sistema central Trane 60.000 BTU",
        created_at=now - timedelta(days=1),
        updated_at=now - timedelta(days=1),
    )
    db.add(ot4)

    ot5 = WorkOrder(
        company_id=company.id, client_id=clients[0].id, technician_id=tech1.id,
        title="Reparación split sala directorio",
        status="rejected", visit_type="charged", visit_cost=15000,
        diagnosis_notes="Fuga de refrigerante grave. Reparación no es costo-eficiente vs. compra equipo nuevo.",
        equipment_info="LG 12.000 BTU",
        created_at=now - timedelta(days=20),
        updated_at=now - timedelta(days=18),
    )
    db.add(ot5)

    db.commit()
    print("OK: Base de datos inicializada con datos demo.")
