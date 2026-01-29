"""Application configuration."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "Image DeMosaique API"
    debug: bool = True
    cors_origins: list[str] = ["*"]  # Allow all origins for development

    class Config:
        env_file = ".env"


settings = Settings()
