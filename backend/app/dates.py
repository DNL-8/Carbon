from datetime import UTC, datetime


def js_iso_timestamp(value: datetime) -> str:
    """Match Date.toJSON() for PostgreSQL timestamptz values."""
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
