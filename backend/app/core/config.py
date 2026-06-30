"""Application configuration loaded from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Application
    app_name: str = "AI Business Analytics"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"

    # Database
    database_url: str = "sqlite+aiosqlite:///./app.db"

    # Auth
    auth_email: str = "balaji@aibusinessanalytics.com"
    auth_password: str = "Password1!"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 720

    # Scraper
    scraper_adapter: str = "mock"  # html | mock
    scraper_proxy_url: str = ""
    scraper_max_retries: int = 3
    scraper_timeout_seconds: int = 20
    scraper_request_delay_seconds: float = 2.0  # polite delay between ASIN requests
    amazon_base_url: str = "https://www.amazon.in/dp/"

    # AI / LLM
    llm_provider: str = "mock"  # mock | openai | anthropic
    llm_api_key: str = ""
    llm_model: str = ""

    # Scheduler
    scrape_hours: str = "6,14,22"

    # CORS
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def scrape_hours_list(self) -> list[int]:
        return [int(h.strip()) for h in self.scrape_hours.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
