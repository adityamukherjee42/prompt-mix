from __future__ import annotations

import time
from statistics import mean

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from combinatorics import generate_combinations
from llm_client import LLMJudge, OpenAIClient
from metrics import evaluate_deterministic_metrics
from models import CaseResult, ExperimentRequest, ExperimentResponse, JudgeResult, Summary

load_dotenv()

app = FastAPI(title="Combinatorial Prompt Evaluator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/evaluate", response_model=ExperimentResponse)
async def evaluate(req: ExperimentRequest) -> ExperimentResponse:
    if req.provider.lower() != "openai":
        raise HTTPException(status_code=400, detail="Only provider='openai' is supported in this starter.")

    combos = generate_combinations(req.dimensions)
    llm = OpenAIClient(req.model, req.temperature, req.max_output_tokens)
    judge_model = req.judge_model or req.model
    judge = LLMJudge(judge_model, req.judge.score_min, req.judge.score_max)

    results: list[CaseResult] = []

    for idx, variables in enumerate(combos, start=1):
        try:
            prompt = req.template.format(**variables)
        except KeyError as exc:
            raise HTTPException(status_code=400, detail=f"Missing template variable: {exc}") from exc

        t0 = time.perf_counter()
        llm_out = await llm.generate(prompt)
        latency_ms = int((time.perf_counter() - t0) * 1000)

        det_metrics = evaluate_deterministic_metrics(llm_out.text, req.deterministic_metrics)
        det_metrics["latency_ms"] = latency_ms

        judge_result = None
        if req.judge.enabled:
            score, rationale = await judge.judge(prompt, llm_out.text, req.judge.criteria)
            passed = None
            if score is not None:
                passed = score >= ((req.judge.score_min + req.judge.score_max) / 2)
            judge_result = JudgeResult(score=score, passed=passed, rationale=rationale)

        results.append(
            CaseResult(
                case_id=idx,
                variables=variables,
                prompt=prompt,
                response_text=llm_out.text,
                latency_ms=latency_ms,
                deterministic_metrics=det_metrics,
                judge=judge_result,
            )
        )

    avg_latency = float(mean([r.latency_ms for r in results])) if results else 0.0
    judge_scores = [r.judge.score for r in results if r.judge and r.judge.score is not None]
    avg_judge_score = float(mean(judge_scores)) if judge_scores else None

    return ExperimentResponse(
        summary=Summary(
            total_cases=len(results),
            avg_latency_ms=avg_latency,
            avg_judge_score=avg_judge_score,
        ),
        results=results,
    )
