"""Exercise Alembic on a dedicated empty loopback PostgreSQL database."""
import os
import subprocess
import sys

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url


def migrate(*args, bootstrap=False, success=True):
    env = {**os.environ, "MURIM_BOOTSTRAP_EMPTY": "1" if bootstrap else "0"}
    result = subprocess.run([sys.executable, "-m", "alembic", *args],
                            env=env, capture_output=True, text=True, check=False)
    if (result.returncode == 0) != success:
        raise RuntimeError(result.stdout + result.stderr)


def main():
    url = make_url(os.environ["MURIM_MIGRATION_DATABASE_URL"])
    if (url.get_backend_name() != "postgresql" or url.host != "127.0.0.1"
            or url.database != "murim_bootstrap_test" or url.query):
        raise RuntimeError("Dedicated local bootstrap database required")
    engine = create_engine(url.set(drivername="postgresql+psycopg"))
    if inspect(engine).get_table_names():
        raise RuntimeError("Bootstrap test requires an empty database")
    migrate("upgrade", "head", success=False)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE auth_user(id text PRIMARY KEY)"))
    migrate("upgrade", "head", bootstrap=True, success=False)
    with engine.begin() as conn:
        assert inspect(conn).get_table_names() == ["auth_user"]
        conn.execute(text("DROP TABLE auth_user"))
    migrate("upgrade", "head", bootstrap=True)
    migrate("check")
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO auth_user(id,name,email) VALUES "
                          "('bootstrap-fixture','Fixture','fixture@example.test')"))
        conn.execute(text("INSERT INTO fitness_progress(user_id,xp) VALUES "
                          "('bootstrap-fixture',42)"))
    migrate("downgrade", "base")
    migrate("upgrade", "head")
    migrate("check")
    with engine.connect() as conn:
        assert conn.execute(text("SELECT xp FROM fitness_progress WHERE "
                                 "user_id='bootstrap-fixture'")).scalar_one() == 42
    engine.dispose()
    print("Alembic: empty bootstrap, partial-schema refusal, and data preservation passed.")


if __name__ == "__main__":
    main()
