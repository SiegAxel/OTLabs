from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://user:password@localhost:3306/otlabs_db"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    DEBUG: bool = True
    API_VERSION: str = "v1"

    SWAGGER_USER: str = "admin"
    SWAGGER_PASSWORD: str = "admin123"

    RESEND_API_KEY: str = ""
    VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    EMAIL_FROM: str = "noreply@resend.dev"
    BASE_URL: str = "http://localhost:8000"
    INITIAL_ADMIN_USERNAME: str = ""
    INITIAL_ADMIN_EMAIL: str = ""
    INITIAL_ADMIN_PASSWORD: str = ""

    model_config = SettingsConfigDict(env_file=".env")

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_mode(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "production", "prod"}:
                return False
            if normalized in {"debug", "development", "dev"}:
                return True
        return value


settings = Settings()
