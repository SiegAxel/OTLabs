from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic/create_all can see them
from app.models import company, user, client, work_order, quotation, payment, evidence  # noqa: F401, E402
