from __future__ import annotations

from itertools import product


def generate_combinations(dimensions: dict[str, list[str]]) -> list[dict[str, str]]:
    if not dimensions:
        return [{}]

    keys = list(dimensions.keys())
    values = [dimensions[k] if dimensions[k] else [""] for k in keys]
    combos = []
    for row in product(*values):
        combos.append({k: v for k, v in zip(keys, row)})
    return combos
