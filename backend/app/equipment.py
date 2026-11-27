"""Equipment catalog, legacy identifiers and set bonuses from Nitro."""
import json
from collections import Counter
from pathlib import Path

_DATA = json.loads((Path(__file__).parent / "data" / "equipment.json").read_text(encoding="utf-8"))
CATALOG = _DATA["equipment"]
SETS = _DATA["sets"]
LEGACY_IDS = _DATA["legacy"]
DEFAULT_GEAR = _DATA["defaults"]
BY_ID = {item["id"]: item for item in CATALOG}
RARITY_ORDER = {"Comum": 1, "Raro": 2, "Épico": 3, "Lendário": 4}
SLOTS = {"elmo": "helm", "armadura": "armor", "capa": "cape", "arma": "weapon"}
BONUS_KEYS = ("xpBonusPercent", "coinBonusPercent", "bossDamageBonusPercent")


def migrate_equipment_id(raw):
    if not isinstance(raw, str) or not raw:
        return None
    mapped = LEGACY_IDS.get(raw, raw)
    return mapped if mapped in BY_ID else None


def migrate_gear(raw) -> dict:
    if not isinstance(raw, (dict, list)):
        return dict(DEFAULT_GEAR)
    raw = raw if isinstance(raw, dict) else {}
    gear = {}
    for slot, old in SLOTS.items():
        value = raw.get(slot)
        ident = migrate_equipment_id(value if value is not None else raw.get(old))
        gear[slot] = ident if ident and BY_ID[ident]["slot"] == slot else None
    return gear


def gear_bonus(raw) -> dict:
    gear = migrate_gear(raw)
    result = dict.fromkeys(BONUS_KEYS, 0)
    result.update(totalPowerScore=0, dominantRarity="Comum", dominantRarityKey="comum",
                  auraMultiplier=1, activeSets=[], bonuses=[])
    counts = Counter()
    for ident in gear.values():
        if ident is None:
            continue
        item = BY_ID[ident]
        for key in BONUS_KEYS:
            result[key] += item[key]
        result["totalPowerScore"] += item["powerScore"]
        if RARITY_ORDER[item["rarity"]] > RARITY_ORDER[result["dominantRarity"]]:
            result.update(dominantRarity=item["rarity"], dominantRarityKey=item["rarityKey"],
                          auraMultiplier=item["auraMultiplier"])
        if item.get("setId"):
            counts[item["setId"]] += 1
    for definition in SETS:
        count = counts[definition["id"]]
        if not count:
            continue
        four = definition.get("fourPieceBonus") if count >= 4 else None
        bonus = four or (definition["twoPieceBonus"] if count >= 2 else None)
        if bonus:
            for key in BONUS_KEYS:
                result[key] += bonus[key]
            result["totalPowerScore"] += 45 if four else 18
        result["activeSets"].append({
            "set": definition, "equippedCount": count, "twoPieceActive": count >= 2,
            "fourPieceActive": bool(four),
        })
    result["activeSets"].sort(key=lambda item: -item["equippedCount"])
    return result
