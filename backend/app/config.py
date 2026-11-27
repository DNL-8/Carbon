from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = ""
    enable_writes: bool = False
    auth_origin: str = ""
    auth_provider: Literal["better-auth", "authlib"] = "better-auth"
    python_auth_secret: str = ""
    google_users: dict[str, str] = Field(default_factory=dict)
    better_auth_url: str = ""
    strava_client_id: str = ""
    strava_client_secret: str = ""
    strava_session_secret: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    gemini_api_key: str = ""
    gemini_model: str = ""
    vercel_git_commit_sha: str = ""

    @field_validator("auth_origin")
    @classmethod
    def validate_origin(cls, value: str) -> str:
        if not value:
            return value
        parts = urlsplit(value)
        local = parts.hostname in {"localhost", "127.0.0.1", "::1"}
        if (
            not parts.hostname
            or parts.username is not None
            or parts.password is not None
            or parts.path not in {"", "/"}
            or parts.query
            or parts.fragment
            or not (parts.scheme == "https" or (local and parts.scheme == "http"))
        ):
            raise ValueError("AUTH_ORIGIN must be an HTTPS origin or local HTTP origin")
        return value.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
