
import React, { useEffect, useState, useRef } from 'react'

const MOCK_BASE = '/mock'

export default function ChatTestScreen({ sessionId, setSessionId, unitTitle, unitId, onBack, onUserSelect }) {
  const [session, setSession] = useState(null)
  const [unitQuestions, setUnitQuestions] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingAck, setStreamingAck] = useState('')

  // Current question data for display
  const [currentQuestion, setCurrentQuestion] = useState(null)

  const chatRef = useRef(null)

  // Avatar selection based on progress
  // マナビーのアバターを進捗に応じて選択 (現在は常に青色のロボットを使用)
  function getManabeeAvatar() {
    return '/mock/assets/manabee-robot.svg'
  }

  // Load session state periodically
  useEffect(() => {
    if (!sessionId) return
    const loadState = () => {
      fetch(`${MOCK_BASE}/get_session_state?session_id=${sessionId}`).then(r => r.json()).then(data => {
        setSession(prev => {
          try {
            const prevQ = prev && prev.current_qid
            const newQ = data && data.current_qid
            if (newQ && newQ !== prevQ) {
              fetch(`${MOCK_BASE}/get_question?qid=${newQ}`).then(r => r.json()).then(q => setCurrentQuestion(q)).catch(() => { })
            }
          } catch (e) { }
          return data
        })
      }).catch(() => { })
    }
    loadState()
    const iv = setInterval(loadState, 5000)
    return () => clearInterval(iv)
  }, [sessionId])

  // Load unit questions for "X / Y" display
  useEffect(() => {
    fetch(`${MOCK_BASE}/list_units`).then(r => r.json()).then(j => {
      if (j && j.units) {
        const u = (unitId && j.units.find(x => x.unit_id === unitId)) || (j.units[0])
        setUnitQuestions(u ? (u.questions || []) : [])
      }
    }).catch(() => { })
  }, [unitId])

  function send() {
    if (!input || !sessionId) return

    const userMessage = input
    const tempId = `agent-${Date.now()}`
    setInput('')
    setSending(true)
    setStreamingAck('送信中...')

    // Optimistically append user + placeholder agent to keep UI responsive
    setSession(prev => {
      const base = prev || { session_id: sessionId, message_history: [] }
      const history = base.message_history ? [...base.message_history] : []
      history.push({ role: 'user', text: userMessage, at: new Date().toISOString() })
      history.push({ role: 'agent', text: '', at: new Date().toISOString(), avatar: getManabeeAvatar(), temp_id: tempId })
      return { ...base, message_history: history }
    })

    const streamUrl = `${MOCK_BASE}/send_user_message_stream`

    const applyDelta = (deltaText) => {
      if (!deltaText) return
      setSession(prev => {
        if (!prev || !prev.message_history) return prev
        const history = prev.message_history.map(m => m.temp_id === tempId ? { ...m, text: (m.text || '') + deltaText } : m)
        return { ...prev, message_history: history }
      })
    }

    const finalizeAgent = (finalText, serverSession) => {
      if (serverSession && serverSession.message_history) {
        setSession(serverSession)
        return
      }
      setSession(prev => {
        if (!prev || !prev.message_history) return prev
        const history = prev.message_history.map(m => m.temp_id === tempId ? { ...m, text: finalText, temp_id: undefined } : m)
        return { ...prev, message_history: history }
      })
    }

    const sendFallback = async () => {
      try {
        const r = await fetch(`${MOCK_BASE}/send_user_message`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, user_message: userMessage })
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error || 'failed to send')
        setSession(data.session || data)
      } catch (err) {
        console.error('fallback send failed', err)
      } finally {
        setSending(false)
      }
    }

      ; (async () => {
        try {
          const res = await fetch(streamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, user_message: userMessage })
          })

          if (!res.ok || !res.body) {
            throw new Error('stream endpoint unavailable')
          }

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split('\n')
            buffer = parts.pop() || ''
            for (const raw of parts) {
              const line = raw.trim()
              if (!line) continue
              const payloadText = line.startsWith('data:') ? line.slice(5).trim() : line
              let evt
              try {
                evt = JSON.parse(payloadText)
              } catch (e) {
                continue
              }
              if (evt.event === 'token') {
                if (!streamingAck) setStreamingAck('受信しました。考えています...')
                applyDelta(evt.text || '')
              } else if (evt.event === 'end') {
                finalizeAgent(evt.text || '', evt.session)
              }
            }
          }

          // Flush remaining buffer if any
          if (buffer.trim()) {
            try {
              const evt = JSON.parse(buffer.replace(/^data:\s*/, '').trim())
              if (evt.event === 'end') finalizeAgent(evt.text || '', evt.session)
              if (evt.event === 'token') applyDelta(evt.text || '')
            } catch (e) { }
          }

          setSending(false)
          setStreamingAck('')
        } catch (err) {
          console.error('stream send failed, falling back', err)
          sendFallback()
        }
      })()
  }

  // Auto-scroll
  useEffect(() => {
    try {
      const node = chatRef.current
      if (!node) return
      setTimeout(() => {
        node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
      }, 80)
    } catch (e) { }
  }, [session && session.message_history && session.message_history.length])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', gap: '16px', justifyContent: 'center' }}>
      {/* Centered Chat Area */}
      <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost small" onClick={onBack}>戻る</button>
            <img className="chat-header-avatar" src={getManabeeAvatar()} alt="manabee" />
            <div>
              <div className="chat-unit-title">{unitTitle || '選択された単元'}</div>
              {currentQuestion && <div className="chat-question-sub">{currentQuestion.title || currentQuestion.prompt}</div>}
              {session && session.current_qid && unitQuestions && unitQuestions.length > 0 && (
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  現在: {Math.max(1, (unitQuestions.indexOf(session.current_qid) !== -1 ? unitQuestions.indexOf(session.current_qid) + 1 : 1))} / {unitQuestions.length} 問目
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              className="btn btn-ghost small"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onUserSelect === 'function') onUserSelect()
              }}
            >ユーザ選択</button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-container" ref={chatRef} style={{ flex: '1 1 auto', overflowY: 'auto' }}>
          {!session && <div style={{ padding: 20 }}>Loading session...</div>}
          {session && session.message_history && session.message_history.map((m, i) => (
            <div key={i} className={`msg-row ${m.role === 'user' ? 'user-message' : ''}`}>
              {m.role === 'agent' && (
                <img className="msg-avatar" src={getManabeeAvatar()} alt="manabee" />
              )}
              <div className="msg-content">
                <div className="msg-role">{m.role === 'agent' ? 'マナビー' : m.role === 'user' ? 'あなた' : m.role}</div>
                <div className={`msg-bubble ${m.role === 'agent' ? 'msg-agent' : m.role === 'user' ? 'msg-user' : ''}`}>
                  {(m.role === 'agent' && i === 0 && !m.text) ? (
                    <>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>こんにちは！</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {(currentQuestion ? (currentQuestion.prompt || currentQuestion.title) : '')}
                      </div>
                    </>
                  ) : (m.text)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {sending && streamingAck && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: '#f5f7ff', border: '1px solid #d6ddff', color: '#3049a1', fontSize: 13 }}>
            マナビー返信中… 受信しました。考えています…
          </div>
        )}

        {/* Input Area */}
        <div className="composer">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={'マナビーに教えてあげる（例: if文は条件分岐だよ）'}
            style={{ minHeight: '80px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              className="btn"
              onClick={send}
              disabled={sending || !input}
              style={{
                opacity: sending ? 0.7 : 1,
                cursor: sending ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {sending && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animation: 'spin 1s linear infinite' }}
                >
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              )}
              {sending ? '送信中...' : '送信'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
