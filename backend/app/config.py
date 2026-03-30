from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_host: str = "doltdb"
    database_port: int = 3306
    database_name: str = "bookshelf"
    database_user: str = "root"
    database_password: str = ""
    admin_password: str = "changeme"
    secret_key: str = "dev-secret-change-in-production"
    google_books_api_key: str = ""
    library_name: str = "Our Bookshelf"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+asyncmy://{self.database_user}:{self.database_password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
        )


settings = Settings()
