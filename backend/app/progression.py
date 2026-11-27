"""Pure progression rules ported from progressionCurves.ts and rpgLogic.ts."""
import json
import math
from datetime import date
from pathlib import Path

_DATA = json.loads((Path(__file__).parent / "data" / "progression.json").read_text(encoding="utf-8"))
LEVELS = _DATA["LEVEL_THRESHOLDS"]
RANKS = _DATA["HUNTER_RANK_TIERS"]
REALMS = _DATA["MURIM_REALM_TIERS"]
CURVE = _DATA["MURIM_XP_CURVE_POINTS"]
DAYS_PER_RANK = 30


def sanitize_xp(xp: float) -> int:
    return max(0, math.floor(xp)) if math.isfinite(xp) else 0


def js_round(number: float) -> int:
    # Inputs here are non-negative, matching Math.round rather than bankers' rounding.
    whole = math.floor(number)
    return whole + int(number - whole >= 0.5)


def percent(value: float) -> int:
    return min(100, max(0, js_round(value)))


def calculate_level(xp: float) -> int:
    safe = sanitize_xp(xp)
    return next(row["level"] for row in reversed(LEVELS) if safe >= row["minXp"])


def level_progress(xp: float) -> dict:
    safe = sanitize_xp(xp)
    level = calculate_level(safe)
    current = LEVELS[level - 1]
    nxt = LEVELS[level] if level < len(LEVELS) else None
    into = safe - current["minXp"]
    return {
        "level": level, "isMaster": level >= 5, "isMaxLevel": nxt is None,
        "levelTitle": current["title"], "currentLevelMinXp": current["minXp"],
        "nextLevelXp": nxt["minXp"] if nxt else current["minXp"],
        "xpIntoLevel": into, "xpNeededForNext": max(0, nxt["minXp"] - safe) if nxt else 0,
        "progressPercent": percent(into / max(1, nxt["minXp"] - current["minXp"]) * 100)
        if nxt else 100,
    }


def hunter_rank_progress(level: float, xp: float | None = None) -> dict:
    safe_level = calculate_level(xp) if xp is not None else max(
        1, math.floor(level) if math.isfinite(level) else 1,
    )
    index = next(
        (i for i, rank in enumerate(RANKS)
         if rank["minLevel"] <= safe_level <= rank["maxLevel"]),
        len(RANKS) - 1 if safe_level > RANKS[-1]["maxLevel"] else 0,
    )
    current = RANKS[index]
    nxt = RANKS[index + 1] if index + 1 < len(RANKS) else None
    if not nxt:
        return {"current": current, "next": None, "level": safe_level, "isMaxRank": True,
                "levelsNeededForNext": 0, "xpNeededForNextRank": 0,
                "estimatedDaysToNextRank": 0, "progressPercent": 100}
    start = LEVELS[current["minLevel"] - 1]["minXp"]
    end = LEVELS[nxt["minLevel"] - 1]["minXp"]
    effective = sanitize_xp(xp) if xp is not None else LEVELS[safe_level - 1]["minXp"]
    span = max(1, end - start)
    needed = max(0, end - effective)
    return {
        "current": current, "next": nxt, "level": safe_level, "isMaxRank": False,
        "levelsNeededForNext": max(1, nxt["minLevel"] - safe_level),
        "xpNeededForNextRank": needed,
        "estimatedDaysToNextRank": max(1, math.ceil(needed / span * DAYS_PER_RANK)) if needed else 0,
        "progressPercent": percent((effective - start) / span * 100),
    }


def calculate_murim_qi(xp: float) -> int:
    safe = sanitize_xp(xp)
    index = next(i for i in range(len(CURVE) - 1, -1, -1) if safe >= CURVE[i]["startXp"])
    point = CURVE[index]
    if index == len(CURVE) - 1:
        previous = CURVE[index - 1]
        span_xp = max(1, point["startXp"] - previous["startXp"])
        span_qi = max(1, point["minQi"] - previous["minQi"])
    else:
        nxt = CURVE[index + 1]
        span_xp = max(1, nxt["startXp"] - point["startXp"])
        span_qi = max(0, nxt["minQi"] - point["minQi"])
    return point["minQi"] + math.floor((safe - point["startXp"]) * span_qi / span_xp)


def realm_for_qi(qi: int) -> dict:
    return next(row for row in reversed(REALMS) if qi >= row["minQi"])


def recalculate_progression(xp: float) -> dict:
    safe = sanitize_xp(xp)
    level = calculate_level(safe)
    rank = hunter_rank_progress(level, safe)
    qi = calculate_murim_qi(safe)
    return {
        "totalXp": safe, "level": level, "rank": rank["current"]["rank"],
        "rankDefinition": rank["current"], "levelProgress": level_progress(safe),
        "rankProgress": rank, "murimQi": qi, "murimRealm": realm_for_qi(qi),
    }


def effective_streak(streak: int, last_day: str | None, today: str) -> int:
    if not last_day or streak <= 0:
        return 0
    return streak if (date.fromisoformat(today) - date.fromisoformat(last_day)).days <= 1 else 0


def murim_qi_points(stats: dict, today: str) -> dict:
    streak = effective_streak(stats["currentStreak"], stats["lastWorkoutDate"], today)
    breakdown = {
        "fromWorkouts": max(0, math.floor(stats["totalWorkouts"])) * 25,
        "fromBosses": max(0, math.floor(stats.get("bossesDefeated") or 0)) * 45,
        "fromStreak": max(0, math.floor(stats["longestStreak"])) * 15 + streak * 10,
        "fromMinutes": math.floor(max(0, stats["totalMinutes"]) / 10),
        "fromXp": calculate_murim_qi(stats.get("totalXp") or 0),
    }
    activity_qi = sum(value for key, value in breakdown.items() if key != "fromXp")
    return {"qiPoints": max(activity_qi, breakdown["fromXp"]), "breakdown": breakdown}


def murim_realm_progress(stats: dict, today: str) -> dict:
    points = murim_qi_points(stats, today)
    qi = points["qiPoints"]
    current = realm_for_qi(qi)
    index = current["order"] - 1
    nxt = REALMS[index + 1] if index + 1 < len(REALMS) else None
    into = max(0, qi - current["minQi"])
    needed = max(0, nxt["minQi"] - qi) if nxt else 0
    span = max(1, nxt["minQi"] - current["minQi"]) if nxt else 1
    return {
        **points, "current": current, "next": nxt, "qiIntoRealm": into,
        "qiNeededForNext": needed,
        "estimatedDaysToNextRealm": max(1, math.ceil(needed / span * DAYS_PER_RANK))
        if needed else 0,
        "progressPercent": percent(into / span * 100) if nxt else 100,
        "isMaxRealm": nxt is None,
    }


def dual_progression(stats: dict, today: str) -> dict:
    xp = stats["totalXp"]
    return {"hunter": hunter_rank_progress(calculate_level(xp), xp),
            "murim": murim_realm_progress(stats, today)}
