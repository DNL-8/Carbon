import pytest
from pydantic import ValidationError

from app.health_import import Activity, PartialMetric, activity_xp


@pytest.mark.parametrize("field,value", [("sleepHours", 25), ("steps", 250001),
                                         ("restingHeartRate", 301), ("recoveryScore", 101)])
def test_daily_import_bounds(field, value):
    with pytest.raises(ValidationError):
        PartialMetric(dateKey="2026-11-26", **{field: value})


def test_zero_duration_does_not_earn_reward():
    assert activity_xp(0, 10, "Run") == 0


def test_activity_rejects_out_of_range():
    with pytest.raises(ValidationError):
        Activity(externalId="test", source="csv", title="Test", sportType="Run",
                 dateKey="2026-11-26", startedAt="2026-11-26T12:00:00Z",
                 durationMinutes=10081, distanceKm=5, calories=0, elevationGainM=0,
                 avgHeartRate=None, maxHeartRate=None, zoneMinutes=(0, 0, 0, 0, 0),
                 hrSamplePoints=[])
