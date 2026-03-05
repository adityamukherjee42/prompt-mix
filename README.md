# Combinatorial LLM Prompt Tester

Full-stack starter app for testing combinatorial prompt variants with:
- deterministic metrics
- optional LLM-as-a-judge scoring

## Backend (Python / FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Set `OPENAI_API_KEY` to run real model/judge calls. Without it, mocked outputs are returned so you can still test the pipeline.

## Frontend (React JSX / Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and calls backend on `http://localhost:8000`.

## API

### `POST /api/evaluate`
Runs the cartesian product of all values in `dimensions`, renders `template` with each combination, evaluates deterministic metrics, and optionally calls an LLM judge.

Example payload:

```json
{
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "judge_model": "gpt-4.1-mini",
  "template": "{instruction}\\n\\nInput: {input}",
  "dimensions": {
    "instruction": ["Summarize in 1 sentence", "List 3 bullet points"],
    "input": ["The API returned HTTP 503 in prod", "The model output is too verbose"]
  },
  "deterministic_metrics": {
    "expected_substring": "error",
    "regex": "HTTP\\s\\d{3}",
    "required_keywords": ["api", "prod"],
    "max_chars": 300
  },
  "judge": {
    "enabled": true,
    "criteria": "Helpfulness, factuality, and instruction following",
    "score_min": 1,
    "score_max": 10
  }
}
```
