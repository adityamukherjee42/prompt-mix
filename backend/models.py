from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class DeterministicMetricConfig(BaseModel):
    expected_substring: str | None = None
    regex: str | None = None
    required_keywords: list[str] = Field(default_factory=list)
    max_chars: int | None = None


class JudgeConfig(BaseModel):
    enabled: bool = False
    criteria: str = "Helpfulness, factuality, and instruction following"
    score_min: int = 1
    score_max: int = 10


class ExperimentRequest(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4.1-mini"
    judge_model: str | None = None
    template: str = "{instruction}\n\nInput: {input}"
    dimensions: dict[str, list[str]] = Field(default_factory=dict)
    temperature: float = 0.2
    max_output_tokens: int = 300
    deterministic_metrics: DeterministicMetricConfig = Field(default_factory=DeterministicMetricConfig)
    judge: JudgeConfig = Field(default_factory=JudgeConfig)


class JudgeResult(BaseModel):
    score: float | None = None
    passed: bool | None = None
    rationale: str | None = None


class CaseResult(BaseModel):
    case_id: int
    variables: dict[str, str]
    prompt: str
    response_text: str
    latency_ms: int
    deterministic_metrics: dict[str, Any]
    judge: JudgeResult | None = None


class Summary(BaseModel):
    total_cases: int
    avg_latency_ms: float
    avg_judge_score: float | None = None


class ExperimentResponse(BaseModel):
    summary: Summary
    results: list[CaseResult]
