"""SQLAlchemy metadata for the existing Drizzle-managed PostgreSQL schema."""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    MetaData,
    PrimaryKeyConstraint,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, JSONB

metadata = MetaData()


auth_user = Table(
    "auth_user", metadata,
    Column("id", Text, primary_key=True),
    Column("name", Text, nullable=False),
    Column("email", Text, nullable=False),
    Column("email_verified", Boolean, nullable=False, server_default=text("false")),
    Column("image", Text),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    UniqueConstraint("email", name="auth_user_email_unique"),
)

auth_account = Table(
    "auth_account", metadata,
    Column("id", Text, primary_key=True),
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="auth_account_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("provider_id", Text, nullable=False),
    Column("account_id", Text, nullable=False),
    Column("access_token", Text),
    Column("refresh_token", Text),
    Column("id_token", Text),
    Column("access_token_expires_at", DateTime(timezone=True)),
    Column("refresh_token_expires_at", DateTime(timezone=True)),
    Column("scope", Text),
    Column("password", Text),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
)

auth_session = Table(
    "auth_session", metadata,
    Column("id", Text, primary_key=True),
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="auth_session_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("token", Text, nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("ip_address", Text),
    Column("user_agent", Text),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    UniqueConstraint("token", name="auth_session_token_unique"),
)

auth_verification = Table(
    "auth_verification", metadata,
    Column("id", Text, primary_key=True),
    Column("identifier", Text, nullable=False),
    Column("value", Text, nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
)

fitness_achievement = Table(
    "fitness_achievement", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_achievement_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("id", Text, nullable=False),
    Column("unlocked_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    PrimaryKeyConstraint("user_id", "id", name="fitness_achievement_user_id_id_pk"),
)

fitness_arsenal = Table(
    "fitness_arsenal", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_arsenal_user_id_auth_user_id_fk", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("owned", JSONB, nullable=False),
    Column("equipped", JSONB, nullable=False),
    Column("loadouts", JSONB, nullable=False, server_default=text("'[]'::jsonb")),
)

fitness_completion = Table(
    "fitness_completion", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_completion_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("id", Text, nullable=False),
    Column("workout_id", Text, nullable=False),
    Column("workout_snapshot", JSONB),
    Column("boss_defeated", Boolean, nullable=False, server_default=text("false")),
    Column("record_count", Integer, nullable=False, server_default=text("0")),
    Column("sets", JSONB, nullable=False),
    Column("xp", Integer, nullable=False),
    Column("coins", Integer, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    PrimaryKeyConstraint("user_id", "id", name="fitness_completion_user_id_id_pk"),
)
Index("fitness_completion_owner_recent_idx", fitness_completion.c.user_id, fitness_completion.c.created_at.desc().nulls_last(), fitness_completion.c.id.desc().nulls_last())

fitness_custom_workout = Table(
    "fitness_custom_workout", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_custom_workout_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("id", Text, nullable=False),
    Column("data", JSONB, nullable=False),
    PrimaryKeyConstraint("user_id", "id", name="fitness_custom_workout_user_id_id_pk"),
)

fitness_daily_vow = Table(
    "fitness_daily_vow", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_daily_vow_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("id", Text, nullable=False),
    Column("title", Text, nullable=False),
    Column("resolved_day", Text),
    Column("outcome", Text),
    PrimaryKeyConstraint("user_id", "id", name="fitness_daily_vow_user_id_id_pk"),
)

fitness_exercise_record = Table(
    "fitness_exercise_record", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_exercise_record_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("exercise_id", Text, nullable=False),
    Column("best_weight_kg", DOUBLE_PRECISION, nullable=False),
    Column("best_reps", Integer, nullable=False),
    Column("best_volume_kg", DOUBLE_PRECISION, nullable=False),
    Column("estimated_1rm_kg", DOUBLE_PRECISION, nullable=False),
    PrimaryKeyConstraint("user_id", "exercise_id", name="fitness_exercise_record_user_id_exercise_id_pk"),
)

fitness_health_activity = Table(
    "fitness_health_activity", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_health_activity_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("source", Text, nullable=False),
    Column("external_id", Text, nullable=False),
    Column("data", JSONB, nullable=False),
    Column("xp", Integer, nullable=False),
    PrimaryKeyConstraint("user_id", "source", "external_id", name="fitness_health_activity_user_id_source_external_id_pk"),
)

fitness_health_metric = Table(
    "fitness_health_metric", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_health_metric_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("source", Text, nullable=False),
    Column("date_key", Text, nullable=False),
    Column("data", JSONB, nullable=False),
    PrimaryKeyConstraint("user_id", "source", "date_key", name="fitness_health_metric_user_id_source_date_key_pk"),
)

fitness_hero_profile = Table(
    "fitness_hero_profile", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_hero_profile_user_id_auth_user_id_fk", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("data", JSONB, nullable=False),
)

fitness_progress = Table(
    "fitness_progress", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_progress_user_id_auth_user_id_fk", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("xp", Integer, nullable=False, server_default=text("0")),
    Column("coins", Integer, nullable=False, server_default=text("0")),
    Column("hp", Integer, nullable=False, server_default=text("100")),
)

fitness_progress_ledger = Table(
    "fitness_progress_ledger", metadata,
    Column("id", Integer, Identity(always=True), primary_key=True),
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_progress_ledger_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("kind", Text, nullable=False),
    Column("title", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
    Column("xp_delta", Integer, nullable=False),
    Column("coin_delta", Integer, nullable=False),
    Column("total_xp", Integer, nullable=False),
    Column("gold_coins", Integer, nullable=False),
)
Index("fitness_ledger_owner_recent_idx", fitness_progress_ledger.c.user_id, fitness_progress_ledger.c.id.desc().nulls_last())

fitness_quest_claim = Table(
    "fitness_quest_claim", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_quest_claim_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("day", Text, nullable=False),
    Column("quest_id", Text, nullable=False, server_default=text("'workout_today'")),
    Column("xp", Integer, nullable=False),
    Column("coins", Integer, nullable=False),
    PrimaryKeyConstraint("user_id", "day", "quest_id", name="fitness_quest_claim_user_id_day_quest_id_pk"),
)

fitness_weight_check_in = Table(
    "fitness_weight_check_in", metadata,
    Column(
        "user_id", Text,
        ForeignKey("auth_user.id", name="fitness_weight_check_in_user_id_auth_user_id_fk", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("day", Text, nullable=False),
    Column("kg", DOUBLE_PRECISION, nullable=False),
    PrimaryKeyConstraint("user_id", "day", name="fitness_weight_check_in_user_id_day_pk"),
)
