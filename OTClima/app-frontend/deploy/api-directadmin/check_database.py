"""Verify the MariaDB connection using the application's environment variables."""

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config.settings import settings


url = make_url(settings.DATABASE_URL)
print(f"Database URL: {url.render_as_string(hide_password=True)}")

engine = create_engine(settings.DATABASE_URL, connect_args={"connect_timeout": 10})
with engine.connect() as connection:
    print(f"MariaDB version: {connection.execute(text('SELECT VERSION()')).scalar_one()}")

print("Database connection: OK")
