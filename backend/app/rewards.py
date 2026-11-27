"""Workout combat and reward rules ported from Nitro."""
import math
import re
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal

from .progression import js_round


def fixed(value: float, digits: int = 1) -> float:
    # JS Number.toFixed rounds the underlying binary double, not its decimal repr.
    return float(Decimal.from_float(float(value)).quantize(
        Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP,
    ))


def set_target(prescription: str) -> int:
    match = re.search(r"([0-9]+)\s*(?:s[ée]ries?|x\b)", prescription.lower(), re.ASCII)
    return min(12, max(1, int(match[1]) or 3)) if match else 3


def boss_defeated(workout: dict, sets: list[dict], elapsed: int, bonus: int) -> bool:
    counts = Counter(row["exerciseId"] for row in sets if row["reps"] > 0)
    total = len(workout["exercises"])
    if len(counts) >= total:
        return True
    targets = {row["id"]: set_target(row["prescription"]) for row in workout["exercises"]}
    total_sets = sum(targets.values())
    completed_sets = sum(min(target, counts[ident]) for ident, target in targets.items())
    rank = str(workout.get("rank", "F")).strip().upper().removeprefix("RANK ").strip()
    hp = {"F": 35, "E": 45, "D": 55, "C": 75, "B": 90, "A": 110, "S": 140}.get(rank, 35)
    if workout["id"] in {"w-despertar-guerreiro-a", "w-despertar-guerreiro-b"}:
        hp = 35
    if workout["id"] in {"w-calistenia-upper-a", "w-calistenia-lower-b"}:
        hp = 90
    multiplier = 1 + max(0, bonus) / 100
    ratio = max(len(counts) / max(1, total), min(0.95, completed_sets / max(1, total_sets)))
    damage = js_round(ratio * hp * 0.85 * multiplier)
    drain = min(js_round(hp * 0.15 * multiplier),
                math.floor(max(0, elapsed) / max(1, workout["durationMinutes"] * 60)
                           * hp * 0.15 * multiplier))
    return bool(counts) and damage + drain >= hp


def evaluate_record(sets: list[dict], previous: dict | None) -> tuple[bool, dict]:
    keys = ("bestWeightKg", "bestReps", "bestVolumeKg", "estimated1RmKg")
    prev = {key: max(0, (previous or {}).get(key, 0)) for key in keys}
    best = dict(prev)
    has_pr = False
    for row in sets:
        weight = fixed(max(0, min(500, row["weightKg"])))
        reps = max(0, min(500, js_round(row["reps"])))
        if not reps:
            continue
        volume = fixed(weight * reps)
        estimated = fixed(weight if reps == 1 else weight * (1 + min(30, reps) / 30))
        values = dict(zip(keys, (weight, reps, volume, estimated), strict=True))
        for key, value in values.items():
            best[key] = max(best[key], value)
        has_pr |= previous is None or (
            estimated > prev["estimated1RmKg"] or weight > prev["bestWeightKg"]
            or volume > prev["bestVolumeKg"] if weight > 0 else reps > prev["bestReps"]
        )
    return has_pr, best


def session_rewards(workout: dict, sets: list[dict], elapsed: int, bonuses: dict, prs: int) -> dict:
    count = len({row["exerciseId"] for row in sets})
    ratio = min(1, max(0, count / len(workout["exercises"])))
    defeated = boss_defeated(workout, sets, elapsed, bonuses["bossDamageBonusPercent"])
    xp = js_round(workout["baseXp"] * ratio * (1 + max(0, bonuses["xpBonusPercent"]) / 100))
    coins = max(10, js_round(workout["baseXp"] * 0.28 * ratio)) + (25 if defeated else 0)
    coins = js_round(coins * (1 + max(0, bonuses["coinBonusPercent"]) / 100))
    return {"earnedXp": xp + min(100, prs * 20),
            "earnedCoins": coins + min(50, prs * 10), "bossDefeated": defeated}
