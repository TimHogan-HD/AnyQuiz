import { useState } from 'react'
import QUESTIONS from './questions.json'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DOMAINS = [
  'Cloud Concepts',
  'Azure Architecture & Services',
  'Security, Identity & Governance',
  'Cost Management & SLAs',
]

const DOMAIN_COLORS = {
  'Cloud Concepts':                  { bg: '#0f2d4a', accent: '#38bdf8', light: '#e0f2fe' },
  'Azure Architecture & Services':   { bg: '#1a1a2e', accent: '#a78bfa', light: '#ede9fe' },
  'Security, Identity & Governance': { bg: '#1c1917', accent: '#fb923c', light: '#ffedd5' },
  'Cost Management & SLAs':          { bg: '#052e16', accent: '#4ade80', light: '#dcfce7' },
}

const SESSION_OPTIONS = [
  { label: '10 Q',    value: 10  },
  { label: '20 Q',    value: 20  },
  { label: '40 Q',    value: 40  },
  { label: 'All',     value: 460 },
]

const BATCH_SIZE = 10

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function initScores() {
  return Object.fromEntries(DOMAINS.map(d => [d, { correct: 0, attempted: 0 }]))
}

function domainPct(scores, domain) {
  const s = scores[domain]
  return s.attempted === 0 ? null : Math.round((s.correct / s.attempted) * 100)
}

function selectNextBatch(usedIds, domainScores, count = BATCH_SIZE, questionHistory = {}) {
  const available = QUESTIONS.filter(q => !usedIds.has(q.id))
  if (!available.length) return []

  const untried = DOMAINS.filter(d => domainScores[d].attempted === 0)
  const weak = DOMAINS
    .filter(d => domainScores[d].attempted > 0)
    .sort((a, b) => (domainScores[a].correct / domainScores[a].attempted) - (domainScores[b].correct / domainScores[b].attempted))

  const scored = available.map(q => {
    let score = Math.random() * 10
    const pct = domainPct(domainScores, q.domain)
    if (untried.includes(q.domain)) score += 50
    else if (weak[0] === q.domain) score += 40
    else if (weak[1] === q.domain) score += 25
    if (pct !== null) {
      if (pct >= 80 && q.difficulty >= 2) score += 15
      else if (pct < 60 && q.difficulty === 1) score += 10
    }
    const h = questionHistory[q.id]
    if (h && h.attempted > 0) score += (1 - h.correct / h.attempted) * 35
    return { q, score }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, count).map(x => x.q)
}

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'cert-quiz-progress'

function loadFromStorage(certId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    return all[certId] ?? { domainScores: {}, questionHistory: {}, missedIds: [] }
  } catch {
    return { domainScores: {}, questionHistory: {}, missedIds: [] }
  }
}

function saveToStorage(certId, progress) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[certId] = progress
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch { /* storage full or unavailable */ }
}

function useProgress(certId) {
  const [progress, setProgress] = useState(() => loadFromStorage(certId))

  function updateProgress(sessionAnswers, sessionDomainScores) {
    setProgress(prev => {
      const domainScores = { ...sessionDomainScores }

      const questionHistory = { ...prev.questionHistory }
      for (const { questionId, correct } of sessionAnswers) {
        const ex = questionHistory[questionId] ?? { correct: 0, attempted: 0 }
        questionHistory[questionId] = { correct: ex.correct + (correct ? 1 : 0), attempted: ex.attempted + 1 }
      }

      const newMissed = sessionAnswers.filter(a => !a.correct).map(a => a.questionId)
      const missedIds = [...new Set([...prev.missedIds, ...newMissed])]

      const next = { domainScores, questionHistory, missedIds }
      saveToStorage(certId, next)
      return next
    })
  }

  return { ...progress, updateProgress }
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = '#38bdf8' }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div style={{ height: '4px', background: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s ease', borderRadius: '2px' }} />
    </div>
  )
}

// ─── WELCOME ──────────────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }) {
  const [length, setLength] = useState(20)

  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>☁️</div>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#f1f5f9', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '-0.5px', margin: '0 0 8px' }}>
        AZ-900 Quiz
      </h1>
      <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px' }}>
        460 questions · 4 domains · adaptive difficulty
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '28px' }}>
        {DOMAINS.map(d => {
          const c = DOMAIN_COLORS[d]
          return (
            <div key={d} style={{ padding: '10px 12px', background: c.bg, border: `1px solid ${c.accent}33`, borderRadius: '8px', textAlign: 'left' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.accent, marginBottom: '6px' }} />
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>{d}</div>
            </div>
          )
        })}
      </div>

      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace', marginBottom: '10px' }}>SESSION LENGTH</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {SESSION_OPTIONS.map(opt => {
            const active = length === opt.value
            return (
              <button key={opt.value} onClick={() => setLength(opt.value)} style={{
                padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
                border: active ? '1.5px solid #38bdf8' : '1.5px solid #1e293b',
                background: active ? '#0d1b2a' : '#0f172a',
                color: active ? '#38bdf8' : '#475569',
                fontSize: '12px', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",
                transition: 'all 0.15s ease',
              }}>
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <button onClick={() => onStart(length)} style={{
        background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px',
        padding: '12px 40px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
        letterSpacing: '0.3px', fontFamily: "'IBM Plex Mono', monospace",
      }}>
        START
      </button>
    </div>
  )
}

// ─── QUESTION ─────────────────────────────────────────────────────────────────
function QuestionScreen({ question, index, total, domainScores, onSubmit }) {
  const [selected, setSelected] = useState(null)
  const c = DOMAIN_COLORS[question.domain]

  const handleKey = (e) => {
    const map = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 }
    const idx = map[e.key.toLowerCase()]
    if (idx !== undefined && question.options[idx]) {
      setSelected(question.options[idx][0])
    }
    if ((e.key === 'Enter' || e.key === ' ') && selected) {
      onSubmit(selected)
    }
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px 32px' }} onKeyDown={handleKey} tabIndex={0}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
          {index + 1} / {total}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {DOMAINS.map(d => {
            const s = domainScores[d]
            const pct = s.attempted ? Math.round((s.correct / s.attempted) * 100) : null
            const dc = DOMAIN_COLORS[d]
            return (
              <div key={d} title={d} style={{
                padding: '3px 8px', background: dc.bg, border: `1px solid ${dc.accent}33`,
                borderRadius: '4px', fontSize: '10px', color: pct !== null ? dc.accent : '#334155',
                fontFamily: 'monospace', fontWeight: 600,
              }}>
                {pct !== null ? `${pct}%` : '—'}
              </div>
            )
          })}
        </div>
      </div>

      <ProgressBar value={index} max={total} color={c.accent} />

      <div style={{ marginTop: '20px', marginBottom: '8px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', background: c.bg, border: `1px solid ${c.accent}33`,
          borderRadius: '20px', fontSize: '11px', color: c.accent, fontWeight: 600,
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.accent, display: 'inline-block' }} />
          {question.domain}
        </span>
      </div>

      <div style={{ fontSize: '16px', color: '#f1f5f9', lineHeight: '1.65', margin: '16px 0 24px', fontWeight: 500 }}>
        {question.question}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {question.options.map((opt, i) => {
          const letter = opt[0]
          const isSelected = selected === letter
          return (
            <button key={i} onClick={() => setSelected(letter)} style={{
              textAlign: 'left', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
              background: isSelected ? `${c.accent}15` : '#0f172a',
              border: isSelected ? `1.5px solid ${c.accent}` : '1.5px solid #1e293b',
              color: isSelected ? '#f1f5f9' : '#94a3b8',
              fontSize: '14px', lineHeight: '1.5', transition: 'all 0.12s ease',
            }}>
              <span style={{ color: isSelected ? c.accent : '#475569', fontFamily: 'monospace', marginRight: '8px' }}>
                {letter}.
              </span>
              {opt.slice(3)}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#334155', fontFamily: 'monospace' }}>
          1–{question.options.length} or A–{String.fromCharCode(64 + question.options.length)} · Enter to submit
        </span>
        <button onClick={() => selected && onSubmit(selected)} disabled={!selected} style={{
          padding: '10px 28px', borderRadius: '8px', border: 'none',
          background: selected ? c.accent : '#1e293b',
          color: selected ? '#0f172a' : '#334155',
          fontSize: '14px', fontWeight: 700, cursor: selected ? 'pointer' : 'not-allowed',
          fontFamily: "'IBM Plex Mono', monospace", transition: 'all 0.15s ease',
        }}>
          SUBMIT
        </button>
      </div>
    </div>
  )
}

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
function FeedbackScreen({ question, selected, isCorrect, onNext, isLast }) {
  const c = DOMAIN_COLORS[question.domain]

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px 32px' }}>
      <div style={{
        padding: '14px 18px', borderRadius: '10px', marginBottom: '20px',
        background: isCorrect ? '#052e16' : '#1c0a09',
        border: `1.5px solid ${isCorrect ? '#4ade80' : '#f87171'}`,
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontSize: '22px' }}>{isCorrect ? '✓' : '✗'}</span>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: isCorrect ? '#4ade80' : '#f87171' }}>
            {isCorrect ? 'Correct' : 'Incorrect'}
          </div>
          {!isCorrect && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Correct answer: <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{question.answer}</span>
              {' · '}{question.options.find(o => o[0] === question.answer)?.slice(3)}
            </div>
          )}
        </div>
      </div>

      {/* Show all options with correct highlighted */}
      <div style={{ padding: '14px 16px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', lineHeight: '1.5' }}>
          {question.question}
        </div>
        {question.options.map((opt, i) => {
          const letter = opt[0]
          const isRight = letter === question.answer
          const isPicked = letter === selected
          const color = isRight ? '#4ade80' : isPicked ? '#f87171' : '#334155'
          return (
            <div key={i} style={{ fontSize: '12px', color, fontFamily: 'monospace', padding: '2px 0' }}>
              {isRight ? '→ ' : isPicked ? '✗ ' : '  '}{opt}
            </div>
          )
        })}
      </div>

      {/* Bundled explanation */}
      <div style={{
        padding: '14px 16px', background: '#0d1b2a',
        borderLeft: `3px solid ${c.accent}`, borderRadius: '0 8px 8px 0', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '11px', color: c.accent, fontWeight: 600, marginBottom: '6px', fontFamily: 'monospace' }}>
          EXPLANATION
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.65' }}>
          {question.explanation}
        </div>
      </div>

      <button onClick={onNext} style={{
        width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
        background: c.accent, color: '#0f172a',
        fontSize: '14px', fontWeight: 700, cursor: 'pointer',
        fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.5px',
      }}>
        {isLast ? 'VIEW RECAP →' : 'NEXT →'}
      </button>
    </div>
  )
}

// ─── RECAP ────────────────────────────────────────────────────────────────────
function RecapScreen({ domainScores, answers, onRestart }) {
  const total = answers.length
  const correct = answers.filter(a => a.correct).length
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100)
  const passed = pct >= 70

  const [aiRecap, setAiRecap] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [copied, setCopied] = useState(false)

  const copyText = [
    `AZ-900 Session Recap — ${new Date().toLocaleDateString()}`,
    `Overall: ${correct}/${total} (${pct}%)`,
    DOMAINS.map(d => {
      const s = domainScores[d]
      const p = s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0
      return `${d.split(' ')[0]}: ${s.correct}/${s.attempted} (${p}%)`
    }).join(' | '),
    aiRecap?.weak_topics ? `Weak: ${aiRecap.weak_topics.join(', ')}` : '',
    aiRecap?.next_session_focus ? `Focus: ${aiRecap.next_session_focus.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  async function fetchAiRecap() {
    setAiLoading(true)
    setAiError(null)
    try {
      const summary = DOMAINS.map(d => {
        const s = domainScores[d]
        const p = s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0
        return `${d}: ${s.correct}/${s.attempted} (${p}%)`
      }).join('\n')

      const res = await fetch('/api/recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overall: { correct, total, pct }, domainSummary: summary }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAiRecap(data)
    } catch (e) {
      setAiError('Recap unavailable. Check your API key in Vercel env vars.')
    }
    setAiLoading(false)
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(copyText) }
    catch { const t = document.createElement('textarea'); t.value = copyText; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t) }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px 48px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', fontFamily: "'IBM Plex Mono', monospace", marginBottom: '4px' }}>
        Session Recap
      </h2>
      <p style={{ fontSize: '12px', color: '#334155', fontFamily: 'monospace', marginBottom: '24px' }}>
        {new Date().toLocaleDateString()}
      </p>

      {/* Score card */}
      <div style={{
        padding: '20px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center',
        background: passed ? '#052e16' : '#1c0a09',
        border: `1.5px solid ${passed ? '#4ade80' : '#f87171'}`,
      }}>
        <div style={{ fontSize: '52px', fontWeight: 700, color: passed ? '#4ade80' : '#f87171', fontFamily: "'IBM Plex Mono', monospace" }}>
          {pct}%
        </div>
        <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>{correct}/{total} correct</div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: passed ? '#4ade80' : '#f87171', marginTop: '6px' }}>
          {passed ? 'PASSING' : 'NEEDS WORK'} · threshold: 70%
        </div>
      </div>

      {/* Domain breakdown */}
      <div style={{ marginBottom: '20px' }}>
        {DOMAINS.map(d => {
          const s = domainScores[d]
          const p = s.attempted === 0 ? 0 : Math.round((s.correct / s.attempted) * 100)
          const c = DOMAIN_COLORS[d]
          const barColor = p >= 70 ? '#4ade80' : p >= 50 ? '#fbbf24' : '#f87171'
          return (
            <div key={d} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                <span style={{ color: c.accent }}>{d}</span>
                <span style={{ color: s.attempted === 0 ? '#334155' : barColor, fontFamily: 'monospace' }}>
                  {s.attempted === 0 ? '—' : `${s.correct}/${s.attempted} (${p}%)`}
                </span>
              </div>
              <ProgressBar value={s.correct} max={Math.max(s.attempted, 1)} color={barColor} />
            </div>
          )
        })}
      </div>

      {/* AI Recap section */}
      {!aiRecap && !aiLoading && (
        <div style={{ marginBottom: '20px' }}>
          <button onClick={fetchAiRecap} style={{
            width: '100%', padding: '11px', borderRadius: '8px',
            border: '1.5px solid #1e293b', background: '#0f172a',
            color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            fontFamily: "'IBM Plex Mono', monospace", transition: 'all 0.15s ease',
          }}>
            ✦ GENERATE AI RECAP (optional)
          </button>
          {aiError && <div style={{ fontSize: '12px', color: '#f87171', marginTop: '8px', textAlign: 'center' }}>{aiError}</div>}
        </div>
      )}

      {aiLoading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#475569', fontFamily: 'monospace', fontSize: '13px', marginBottom: '20px' }}>
          generating recap...
        </div>
      )}

      {aiRecap && (
        <div style={{ marginBottom: '20px' }}>
          {aiRecap.weak_topics?.length > 0 && (
            <div style={{ padding: '14px 16px', background: '#1c0a09', borderLeft: '3px solid #f87171', borderRadius: '0 8px 8px 0', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#f87171', fontWeight: 600, marginBottom: '8px', fontFamily: 'monospace' }}>REVIEW</div>
              {aiRecap.weak_topics.map((t, i) => <div key={i} style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>· {t}</div>)}
            </div>
          )}
          {aiRecap.next_session_focus?.length > 0 && (
            <div style={{ padding: '14px 16px', background: '#0d1b2a', borderLeft: '3px solid #38bdf8', borderRadius: '0 8px 8px 0', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, marginBottom: '8px', fontFamily: 'monospace' }}>NEXT SESSION</div>
              {aiRecap.next_session_focus.map((t, i) => <div key={i} style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>→ {t}</div>)}
            </div>
          )}
          {aiRecap.encouragement && (
            <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', padding: '0 4px', marginBottom: '10px' }}>
              {aiRecap.encouragement}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={handleCopy} style={{
          flex: 1, padding: '11px', borderRadius: '8px',
          border: '1.5px solid #1e293b', background: copied ? '#052e16' : '#0f172a',
          color: copied ? '#4ade80' : '#64748b',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          fontFamily: "'IBM Plex Mono', monospace", transition: 'all 0.2s ease',
        }}>
          {copied ? 'COPIED ✓' : 'COPY SEED'}
        </button>
        <button onClick={onRestart} style={{
          flex: 1, padding: '11px', borderRadius: '8px', border: 'none',
          background: '#38bdf8', color: '#0f172a',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          NEW SESSION
        </button>
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const { domainScores: savedDomainScores, questionHistory, updateProgress } = useProgress('az-900')
  const [phase, setPhase] = useState('welcome')
  const [sessionLength, setSessionLength] = useState(20)
  const [questions, setQuestions] = useState([])
  const [usedIds, setUsedIds] = useState(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [domainScores, setDomainScores] = useState(initScores())
  const [lastAnswer, setLastAnswer] = useState(null) // { selected, isCorrect }

  function startSession(length) {
    const seededScores = { ...initScores(), ...savedDomainScores }
    const batch = selectNextBatch(new Set(), seededScores, Math.min(BATCH_SIZE, length), questionHistory)
    setSessionLength(length)
    setQuestions(batch)
    setUsedIds(new Set(batch.map(q => q.id)))
    setCurrentIndex(0)
    setAnswers([])
    setDomainScores(seededScores)
    setLastAnswer(null)
    setPhase('question')
  }

  function handleSubmit(selected) {
    const q = questions[currentIndex]
    const isCorrect = selected === q.answer

    const newAnswers = [...answers, { questionId: q.id, selected, correct: isCorrect }]
    setAnswers(newAnswers)

    const newScores = { ...domainScores }
    newScores[q.domain] = {
      correct: newScores[q.domain].correct + (isCorrect ? 1 : 0),
      attempted: newScores[q.domain].attempted + 1,
    }
    setDomainScores(newScores)
    setLastAnswer({ selected, isCorrect })

    // Refill queue if running low and session not finished
    const remaining = questions.length - currentIndex - 1
    if (remaining < 3 && newAnswers.length < sessionLength) {
      const needed = Math.min(BATCH_SIZE, sessionLength - newAnswers.length - remaining)
      if (needed > 0) {
        const next = selectNextBatch(
          new Set(questions.map(q => q.id)),
          newScores,
          needed,
          questionHistory
        )
        if (next.length) {
          setQuestions(prev => [...prev, ...next])
          setUsedIds(prev => new Set([...prev, ...next.map(q => q.id)]))
        }
      }
    }

    setPhase('feedback')
  }

  function endSession(sessionAnswers, sessionScores) {
    updateProgress(sessionAnswers, sessionScores)
    setPhase('recap')
  }

  function handleNext() {
    const nextIdx = currentIndex + 1
    if (nextIdx >= sessionLength || nextIdx >= questions.length) {
      endSession(answers, domainScores)
    } else {
      setCurrentIndex(nextIdx)
      setLastAnswer(null)
      setPhase('question')
    }
  }

  const q = questions[currentIndex]
  const total = Math.min(sessionLength, questions.length + (sessionLength - answers.length))

  return (
    <div style={{ minHeight: '100vh', background: '#070d14', color: '#f1f5f9', paddingTop: '28px' }}>
      {/* Header */}
      {phase !== 'welcome' && phase !== 'recap' && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 16px 18px', maxWidth: '640px', margin: '0 auto',
          borderBottom: '1px solid #0f1f33', marginBottom: '24px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>AZ-900</span>
          <button onClick={() => endSession(answers, domainScores)} style={{
            fontSize: '11px', color: '#475569', background: 'transparent',
            border: '1px solid #1e293b', borderRadius: '4px', padding: '3px 10px',
            cursor: 'pointer', fontFamily: 'monospace',
          }}>
            END SESSION
          </button>
        </div>
      )}

      {phase === 'welcome' && <WelcomeScreen onStart={startSession} />}

      {phase === 'question' && q && (
        <QuestionScreen
          key={q.id}
          question={q}
          index={currentIndex}
          total={sessionLength}
          domainScores={domainScores}
          onSubmit={handleSubmit}
        />
      )}

      {phase === 'feedback' && q && lastAnswer && (
        <FeedbackScreen
          question={q}
          selected={lastAnswer.selected}
          isCorrect={lastAnswer.isCorrect}
          onNext={handleNext}
          isLast={currentIndex + 1 >= sessionLength || currentIndex + 1 >= questions.length}
        />
      )}

      {phase === 'recap' && (
        <RecapScreen
          domainScores={domainScores}
          answers={answers}
          onRestart={() => setPhase('welcome')}
        />
      )}
    </div>
  )
}
