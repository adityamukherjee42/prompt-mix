from __future__ import annotations

import re
from typing import Any

from models import DeterministicMetricConfig


def evaluate_deterministic_metrics(text: str, config: DeterministicMetricConfig) -> dict[str, Any]:
    result: dict[str, Any] = {}

    if config.expected_substring:
        result["contains_expected_substring"] = config.expected_substring in text

    if config.regex:
        result["regex_match"] = bool(re.search(config.regex, text))

    if config.required_keywords:
        missing = [k for k in config.required_keywords if k.lower() not in text.lower()]
        result["required_keywords_pass"] = len(missing) == 0
        result["missing_keywords"] = missing

    char_count = len(text)
    result["char_count"] = char_count

    if config.max_chars is not None:
        result["max_chars_pass"] = char_count <= config.max_chars

    return result
