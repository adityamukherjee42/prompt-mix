from __future__ import annotations

import json
import os
from dataclasses import dataclass

import httpx


@dataclass
class LLMOutput:
    text: str


class OpenAIClient:
    def __init__(self, model: str, temperature: float, max_output_tokens: int):
        self.model = model
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens
        self.api_key = os.getenv("OPENAI_API_KEY")

    async def generate(self, prompt: str) -> LLMOutput:
        if not self.api_key:
            return LLMOutput(text=f"[MOCKED OUTPUT] {prompt[:180]}")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "input": prompt,
            "temperature": self.temperature,
            "max_output_tokens": self.max_output_tokens,
        }
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post("https://api.openai.com/v1/responses", headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        output_text = data.get("output_text")
        if output_text:
            return LLMOutput(text=output_text)

        # Fallback parsing if output_text is not present.
        chunks = []
        for item in data.get("output", []):
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    chunks.append(content.get("text", ""))
        return LLMOutput(text="\n".join(chunks).strip())


class LLMJudge:
    def __init__(self, model: str, score_min: int = 1, score_max: int = 10):
        self.model = model
        self.score_min = score_min
        self.score_max = score_max
        self.api_key = os.getenv("OPENAI_API_KEY")

    async def judge(self, prompt: str, output: str, criteria: str) -> tuple[float | None, str | None]:
        if not self.api_key:
            # Mock score so the pipeline always works locally.
            heuristic = min(self.score_max, max(self.score_min, len(output) // 80 + self.score_min))
            return float(heuristic), "Mocked judge score (no OPENAI_API_KEY configured)."

        judge_prompt = (
            "You are grading LLM outputs. Return strict JSON with keys: score, rationale. "
            f"Use score in range [{self.score_min}, {self.score_max}].\n"
            f"Criteria: {criteria}\n\n"
            f"PROMPT:\n{prompt}\n\nOUTPUT:\n{output}"
        )
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "input": judge_prompt,
            "temperature": 0,
            "max_output_tokens": 200,
        }
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post("https://api.openai.com/v1/responses", headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        txt = data.get("output_text", "").strip()
        try:
            parsed = json.loads(txt)
            score = float(parsed.get("score"))
            rationale = str(parsed.get("rationale", "")).strip() or None
            return score, rationale
        except Exception:
            return None, f"Could not parse judge response as JSON: {txt[:160]}"
