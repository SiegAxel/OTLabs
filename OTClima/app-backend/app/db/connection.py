from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from app.config.settings import settings

def _normalize_database_url(url: str) -> str:
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+pymysql://", 1)
    if url.startswith("mariadb://"):
        return url.replace("mariadb://", "mysql+pymysql://", 1)
    return url


engine = create_engine(
    _normalize_database_url(settings.DATABASE_URL),
    poolclass=NullPool,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.db.base import Base
    try:
        Base.metadata.create_all(bind=engine)
        _bootstrap_rbac_data()
        _bootstrap_company_data()
        print("Database tables created successfully!")
    except Exception as e:
        print(f"Could not connect to database: {e}")
        print("Make sure MariaDB is running and the database exists.")


def _ensure_users_primary_role_column() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "primary_role_id" in user_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN primary_role_id INTEGER"))

        if engine.dialect.name == "postgresql":
            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_primary_role_id'
                        ) THEN
                            ALTER TABLE users
                            ADD CONSTRAINT fk_users_primary_role_id
                            FOREIGN KEY (primary_role_id) REFERENCES roles(id);
                        END IF;
                    END
                    $$;
                    """
                )
            )


def _bootstrap_rbac_data() -> None:
    from app.services.rbac_service import bootstrap_initial_admin, bootstrap_rbac

    db = SessionLocal()
    try:
        bootstrap_rbac(db)
        bootstrap_initial_admin(db)
    finally:
        db.close()


def _ensure_users_registration_columns() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return

    user_columns = {column["name"] for column in inspector.get_columns("users")}

    with engine.begin() as connection:
        if "company_id" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN company_id INTEGER"))
        if "worker_range_id" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN worker_range_id INTEGER"))
        if "account_type" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN account_type VARCHAR(20)"))
        if "account_status" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN account_status VARCHAR(30)"))
        if "terms_accepted" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN terms_accepted BOOLEAN"))
        if "full_name" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(120)"))
        if "phone" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(30)"))
        if "city_commune" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN city_commune VARCHAR(120)"))

        connection.execute(text("UPDATE users SET account_type = 'independent' WHERE account_type IS NULL"))
        connection.execute(text("UPDATE users SET account_status = 'approved' WHERE account_status IS NULL"))
        connection.execute(text("UPDATE users SET terms_accepted = TRUE WHERE terms_accepted IS NULL"))

        if engine.dialect.name == "postgresql":
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_users_company_id ON users (company_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_users_worker_range_id ON users (worker_range_id)"))

            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_company_id'
                        ) THEN
                            ALTER TABLE users
                            ADD CONSTRAINT fk_users_company_id
                            FOREIGN KEY (company_id) REFERENCES companies(id);
                        END IF;
                    END
                    $$;
                    """
                )
            )
            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_worker_range_id'
                        ) THEN
                            ALTER TABLE users
                            ADD CONSTRAINT fk_users_worker_range_id
                            FOREIGN KEY (worker_range_id) REFERENCES worker_ranges(id);
                        END IF;
                    END
                    $$;
                    """
                )
            )


def _bootstrap_company_data() -> None:
    from app.services.company_service import bootstrap_companies_and_worker_ranges

    db = SessionLocal()
    try:
        bootstrap_companies_and_worker_ranges(db)
    finally:
        db.close()


def _ensure_clients_company_column() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "clients" not in table_names:
        return

    client_columns = {column["name"] for column in inspector.get_columns("clients")}

    with engine.begin() as connection:
        if "company_id" not in client_columns:
            connection.execute(text("ALTER TABLE clients ADD COLUMN company_id INTEGER"))

        connection.execute(
            text(
                """
                UPDATE clients
                SET company_id = (SELECT id FROM companies WHERE name = 'Independiente')
                WHERE company_id IS NULL
                """
            )
        )

        if engine.dialect.name == "postgresql":
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_clients_company_id ON clients (company_id)"))
            connection.execute(text("DROP INDEX IF EXISTS ix_clients_rut"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_clients_rut ON clients (rut)"))
            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'fk_clients_company_id'
                        ) THEN
                            ALTER TABLE clients
                            ADD CONSTRAINT fk_clients_company_id
                            FOREIGN KEY (company_id) REFERENCES companies(id);
                        END IF;
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'uq_clients_company_rut'
                        ) THEN
                            ALTER TABLE clients
                            ADD CONSTRAINT uq_clients_company_rut UNIQUE (company_id, rut);
                        END IF;
                    END
                    $$;
                    """
                )
            )


def _ensure_company_profile_columns() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "companies" not in table_names:
        return

    company_columns = {column["name"] for column in inspector.get_columns("companies")}

    with engine.begin() as connection:
        if "logo_path" not in company_columns:
            connection.execute(text("ALTER TABLE companies ADD COLUMN logo_path VARCHAR(500)"))
        if "plan_type" not in company_columns:
            connection.execute(text("ALTER TABLE companies ADD COLUMN plan_type VARCHAR(30)"))
        if "quote_conditions" not in company_columns:
            connection.execute(text("ALTER TABLE companies ADD COLUMN quote_conditions VARCHAR"))
        if "quote_warranty" not in company_columns:
            connection.execute(text("ALTER TABLE companies ADD COLUMN quote_warranty VARCHAR"))

        connection.execute(text("UPDATE companies SET plan_type = 'basic' WHERE plan_type IS NULL"))
