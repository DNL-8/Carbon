from unittest.mock import MagicMock

import pytest

from scripts import legacy_preflight as preflight


@pytest.mark.parametrize(
    "tables,expected",
    [
        (set(), "empty"),
        (set(preflight.TARGET), "target"),
        (set(preflight.LEGACY), "legacy"),
        ({"users", "auth_user"}, "mixed_or_partial"),
        ({"auth_user"}, "mixed_or_partial"),
        (set(preflight.TARGET | preflight.LEGACY), "mixed_or_partial"),
        ({"unrelated"}, "unknown"),
    ],
)
def test_classify(tables, expected):
    assert preflight.classify(tables) == expected


def test_inventory_only_reads_allowlisted_counts(monkeypatch):
    inspector = MagicMock()
    inspector.get_table_names.return_value = ["users", "unrelated", "auth_user"]
    inspector.get_columns.return_value = [{"name": "id"}]
    monkeypatch.setattr(preflight, "inspect", lambda conn: inspector)
    conn = MagicMock()
    conn.execute.return_value.scalar_one.return_value = 2
    result = preflight.inventory(conn)
    assert result["record_counts"] == {"auth_user": 2, "users": 2}
    assert "email" in result["missing_target_columns"]["auth_user"]
    assert result["legacy_account_mapping_required"]
    assert not result["automatic_migration_permitted"]
    assert {str(call.args[0]) for call in conn.execute.call_args_list} == {
        'SELECT count(*) FROM public."auth_user"',
        'SELECT count(*) FROM public."users"',
    }
