from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.engine import Connection, Engine, make_url
from sqlalchemy.exc import SQLAlchemyError

from .config import get_settings


@lru_cache
def engine() -> Engine:
    raw = get_settings().database_url
    if not raw:
        raise HTTPException(503, "Banco de dados indisponivel")
    try:
        url = make_url(raw.replace("postgres://", "postgresql://", 1))
        if url.get_backend_name() != "postgresql":
            raise ValueError("PostgreSQL required")
        return create_engine(
            url.set(drivername="postgresql+psycopg"),
            pool_pre_ping=True,
            pool_size=3,
            max_overflow=0,
            pool_timeout=5,
            connect_args={"connect_timeout": 5},
            hide_parameters=True,
        )
    except (SQLAlchemyError, ValueError):
        raise HTTPException(503, "Banco de dados indisponivel") from None


def get_db() -> Iterator[Connection]:
    try:
        with engine().connect() as conn:
            yield conn
    except SQLAlchemyError:
        raise HTTPException(503, "Banco de dados indisponivel") from None


def get_db_factory():
    """Delay acquiring a connection until external HTTP requests finish."""
    return contextmanager(get_db)
