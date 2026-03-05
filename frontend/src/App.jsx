import { useMemo, useState } from 'react'

const API_BASE = 'http://localhost:8000'

const defaultDimensions = {
  persona: ['You are a seasoned novelist with 20 years of experience.', 'You are a no-nonsense editor at a major newspaper.'],
  context: ['The person asking is a complete beginner who has never written professionally.', 'The person is an experienced blogger looking to write their first book.'],
  instructions: ['Be encouraging and warm. Use concrete examples.', 'Be direct and concise. No fluff, just actionable steps.'],
}

const sectionStyle = {
  persona: 'accent-persona',
  context: 'accent-context',
  instructions: 'accent-instructions',
}

function prettyName(key) {
  if (!key) return ''
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export default function App() {
  const [model, setModel] = useState('gpt-4.1-mini')
  const [judgeModel, setJudgeModel] = useState('gpt-4.1-mini')
  const [template, setTemplate] = useState('{persona}\n{context}\n\nTask: {task}\n\nConstraints: {instructions}')
  const [task, setTask] = useState('What advice would you give someone trying to improve their writing?')
  const [dimensions, setDimensions] = useState(defaultDimensions)
  const [expectedSubstring, setExpectedSubstring] = useState('')
  const [regex, setRegex] = useState('')
  const [keywords, setKeywords] = useState('')
  const [maxChars, setMaxChars] = useState('')
  const [judgeEnabled, setJudgeEnabled] = useState(true)
  const [judgeCriteria, setJudgeCriteria] = useState('Helpfulness, factuality, and instruction following')
  const [judgePassThreshold, setJudgePassThreshold] = useState(7)
  const [deterministicPassRatioThreshold, setDeterministicPassRatioThreshold] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const totalCombinations = useMemo(
    () => Object.values(dimensions).reduce((acc, arr) => acc * (Array.isArray(arr) ? arr.length : 0), 1),
    [dimensions]
  )

  function updateBlock(section, index, value) {
    setDimensions((prev) => ({
      ...prev,
      [section]: prev[section].map((item, i) => (i === index ? value : item)),
    }))
  }

  function removeBlock(section, index) {
    setDimensions((prev) => {
      const next = prev[section].filter((_, i) => i !== index)
      return { ...prev, [section]: next.length ? next : [''] }
    })
  }

  function addBlock(section) {
    setDimensions((prev) => ({
      ...prev,
      [section]: [...prev[section], ''],
    }))
  }

  async function runEvaluation() {
    setLoading(true)
    setError('')
    setResult(null)

    const mergedDimensions = {
      ...dimensions,
      task: [task],
    }

    const payload = {
      provider: 'openai',
      model,
      judge_model: judgeModel,
      template,
      dimensions: mergedDimensions,
      deterministic_metrics: {
        expected_substring: expectedSubstring || null,
        regex: regex || null,
        required_keywords: keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        max_chars: maxChars ? Number(maxChars) : null,
      },
      judge: {
        enabled: judgeEnabled,
        criteria: judgeCriteria,
        score_min: 1,
        score_max: 10,
      },
    }

    try {
      const res = await fetch(`${API_BASE}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || 'Request failed')
      }
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const sectionKeys = Object.keys(dimensions)

  function getCaseStatus(r) {
    const passFlags = Object.entries(r.deterministic_metrics || {})
      .filter(([k, v]) => k.endsWith('_pass') && typeof v === 'boolean')
      .map(([, v]) => v)

    const detPassRatio = passFlags.length
      ? passFlags.filter(Boolean).length / passFlags.length
      : null
    const detPass = detPassRatio !== null
      ? detPassRatio >= Number(deterministicPassRatioThreshold || 0)
      : null

    let judgePass = null
    if (judgeEnabled) {
      judgePass = r.judge?.score != null ? Number(r.judge.score) >= Number(judgePassThreshold || 0) : null
    }

    let status = 'partial'
    if (!judgeEnabled) {
      status = detPass === true ? 'pass' : detPass === false ? 'fail' : 'partial'
    } else if (judgePass === false) {
      // If judge is enabled and fails threshold, mark as fail clearly.
      status = 'fail'
    } else if (judgePass === true && (detPass === true || detPass === null)) {
      status = 'pass'
    } else if (judgePass === true || detPass === true) {
      status = 'partial'
    }
    return { status, detPassRatio, judgePass }
  }

  const passCount = result
    ? result.results.filter((r) => getCaseStatus(r).status === 'pass').length
    : 0

  return (
    <div className="mixerRoot">
      <header className="topBar">
        <div className="brandWrap">
          <h1>PromptMixer</h1>
          <p>swappable block combinations</p>
        </div>
        <div className="comboBadge">{totalCombinations} combos</div>
      </header>

      <main className="mixerMain">
        <aside className="leftPane">
          <label className="smallLabel">CORE TASK / BASE PROMPT</label>
          <textarea className="taskBox" rows={3} value={task} onChange={(e) => setTask(e.target.value)} />

          {sectionKeys.map((section) => (
            <section className="groupCard" key={section}>
              <div className="groupHeader">
                <h2 className={sectionStyle[section] || ''}>
                  <span className="dot" /> {prettyName(section)}
                </h2>
                <span>{dimensions[section].length} active</span>
              </div>

              {dimensions[section].map((block, idx) => (
                <div className="blockRow" key={`${section}-${idx}`}>
                  <textarea
                    rows={2}
                    value={block}
                    onChange={(e) => updateBlock(section, idx, e.target.value)}
                    placeholder={`Add ${section} block...`}
                  />
                  <button type="button" className="deleteBtn" onClick={() => removeBlock(section, idx)}>
                    ×
                  </button>
                </div>
              ))}

              <button type="button" className="addBtn" onClick={() => addBlock(section)}>
                + add {section} block
              </button>
            </section>
          ))}

          <details className="advanced">
            <summary>Advanced Settings</summary>
            <label>Template (Python placeholders)</label>
            <textarea rows={4} value={template} onChange={(e) => setTemplate(e.target.value)} />

            <div className="twoCol">
              <div>
                <label>Model</label>
                <input value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div>
                <label>Judge Model</label>
                <input value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)} />
              </div>
            </div>

            <div className="twoCol">
              <div>
                <label>Expected Substring</label>
                <input value={expectedSubstring} onChange={(e) => setExpectedSubstring(e.target.value)} />
              </div>
              <div>
                <label>Regex</label>
                <input value={regex} onChange={(e) => setRegex(e.target.value)} />
              </div>
            </div>

            <div className="twoCol">
              <div>
                <label>Required Keywords (comma separated)</label>
                <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
              </div>
              <div>
                <label>Max Chars</label>
                <input type="number" value={maxChars} onChange={(e) => setMaxChars(e.target.value)} />
              </div>
            </div>

            <div className="twoCol">
              <div>
                <label>Judge Pass Threshold</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={judgePassThreshold}
                  onChange={(e) => setJudgePassThreshold(e.target.value)}
                />
              </div>
              <div>
                <label>Deterministic Pass Ratio (0-1)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={deterministicPassRatioThreshold}
                  onChange={(e) => setDeterministicPassRatioThreshold(e.target.value)}
                />
              </div>
            </div>

            <label className="checkRow">
              <input type="checkbox" checked={judgeEnabled} onChange={(e) => setJudgeEnabled(e.target.checked)} />
              Enable LLM-as-a-judge
            </label>

            <label>Judge Criteria</label>
            <textarea rows={3} value={judgeCriteria} onChange={(e) => setJudgeCriteria(e.target.value)} />
          </details>

          <button className="runBtn" onClick={runEvaluation} disabled={loading}>
            ▶ {loading ? 'Running...' : `Run ${totalCombinations} Combinations`}
          </button>

          {error ? <div className="errorBox">{error}</div> : null}
        </aside>

        <section className="rightPane">
          {!result ? (
            <div className="emptyState">
              <div className="chipRow">
                {sectionKeys.map((k) => (
                  <span key={k} className={`chip ${sectionStyle[k] || ''}`}>
                    {prettyName(k)}
                  </span>
                ))}
              </div>
              <p>Each unique combination of blocks becomes a separate prompt run.</p>
              <p>Add blocks on the left, then hit Run.</p>
            </div>
          ) : (
            <>
              <div className="summaryStrip">
                <div>Total: {result.summary.total_cases}</div>
                <div>Avg latency: {result.summary.avg_latency_ms.toFixed(1)} ms</div>
                <div>
                  Avg judge:{' '}
                  {result.summary.avg_judge_score === null ? 'N/A' : result.summary.avg_judge_score.toFixed(2)}
                </div>
                <div>Passing cases: {passCount}</div>
              </div>

              <div className="resultsList">
                {result.results.map((r) => {
                  const status = getCaseStatus(r)
                  return (
                  <article className={`resultCard status-${status.status}`} key={r.case_id}>
                    <h3>Case {r.case_id}</h3>
                    <div className="statusMeta">
                      Status: {status.status.toUpperCase()} | Det pass ratio:{' '}
                      {status.detPassRatio === null ? 'N/A' : status.detPassRatio.toFixed(2)} | Judge:{' '}
                      {judgeEnabled ? (status.judgePass === null ? 'N/A' : status.judgePass ? 'PASS' : 'FAIL') : 'OFF'}
                    </div>
                    <pre>{JSON.stringify(r.variables, null, 2)}</pre>
                    <p>{r.response_text}</p>
                    <pre>{JSON.stringify(r.deterministic_metrics, null, 2)}</pre>
                    {r.judge ? <pre>{JSON.stringify(r.judge, null, 2)}</pre> : null}
                  </article>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
