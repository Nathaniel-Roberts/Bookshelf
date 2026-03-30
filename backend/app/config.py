import secrets
import sys

from pydantic_settings import BaseSettings

_INSECURE_DEFAULT = "dev-secret-change-in-production"


class Settings(BaseSettings):
    database_host: str = "doltdb"
    database_port: int = 3306
    database_name: str = "bookshelf"
    database_user: str = "root"
    database_password: str = ""
    admin_password: str = "changeme"
    secret_key: str = _INSECURE_DEFAULT
    google_books_api_key: str = ""
    library_name: str = "Our Bookshelf"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+asyncmy://{self.database_user}:{self.database_password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
        )


settings = Settings()

if not settings.secret_key or settings.secret_key == _INSECURE_DEFAULT:
    print(
        "WARNING: SECRET_KEY is not set. Generating a random key for this session. "
        "JWTs will be invalidated on restart. Set SECRET_KEY in your .env for persistence.",
        file=sys.stderr,
    )
    settings.secret_key = secrets.token_urlsafe(32)
