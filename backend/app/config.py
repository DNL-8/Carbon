from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = ""
    enable_writes: bool = False
    python_auth_secret: str = ""
    google_users: dict[str, str] = Field(default_factory=dict)
    app_origin: str = ""
    strava_client_id: str = ""
    strava_client_secret: str = ""
    strava_session_secret: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    gemini_api_key: str = ""
    gemini_model: str = ""
    vercel_git_commit_sha: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
