import React, { useState, useEffect } from 'react'
import ChatTestScreen from './components/ChatTestScreen.jsx'
import Home from './components/Home.jsx'
import UnitSelector from './components/UnitSelector.jsx'
import UserSelector from './components/UserSelector.jsx'

// Use relative path for Vite dev proxy
const MOCK_BASE = '/mock'

export default function App() {
  const [screen, setScreen] = useState('select_user')
  const [chosenUnit, setChosenUnit] = useState(null)
  const [chosenUnitId, setChosenUnitId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [previousScreen, setPreviousScreen] = useState(null) // ユーザー選択前の画面を記憶
  const [overallProgress, setOverallProgress] = useState(0) // 全体の進捗を保持

  // 進捗に応じたマナビーのアバターを取得 (現在は常に青色のロボットを使用)
  const getManabeeAvatar = () => {
    return '/mock/assets/manabee-robot.svg'
  }

  // ユーザーの進捗を取得する関数
  const fetchUserProgress = async (userId) => {
    if (!userId) return
    try {
      const res = await fetch(`/mock/list_units?user_id=${encodeURIComponent(userId)}`)
      const data = await res.json()
      if (data && data.progress && data.progress.units) {
        const units = data.progress.units
        const percents = units.map(u => u.percent_known || 0)
        const overall = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0
        setOverallProgress(overall)
      }
    } catch (err) {
      console.error('Failed to fetch user progress:', err)
    }
  }

  // ユーザーが選択されたら進捗を取得
  useEffect(() => {
    if (selectedUser) {
      fetchUserProgress(selectedUser)
    }
  }, [selectedUser])

  // On app mount, try to restore session from localStorage
  useEffect(() => {
    const sid = localStorage.getItem('session_id')
    const suser = localStorage.getItem('session_user')
    if (!sid || !suser) return
    // try to fetch session state and verify user
    fetch(`${MOCK_BASE}/get_session_state?session_id=${sid}`).then(r => {
      if (!r.ok) throw new Error('no session')
      return r.json()
    }).then(data => {
      if (data && data.user_id && data.user_id === suser) {
        setSessionId(sid)
        setSelectedUser(suser)
        // set chosen unit id from session and attempt to resolve a title
        const uid = data.unit_id || null
        setChosenUnitId(uid)
        // fetch units to map title
        fetch(`${MOCK_BASE}/list_units`).then(r => r.json()).then(j => {
          const u = (j && j.units) ? j.units.find(x => x.unit_id === uid) : null
          setChosenUnit(u ? u.title : null)
        }).catch(() => { })
        setScreen('chat')
      }
    }).catch(() => {
      // ignore: no valid session to restore
    })
  }, [])

  // If user selection changes, clear stored session if it belongs to another user
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('session_user')
      if (selectedUser && storedUser && storedUser !== selectedUser) {
        localStorage.removeItem('session_id')
        localStorage.removeItem('session_user')
        setSessionId(null)
      }
    } catch (e) { }
  }, [selectedUser])

  function startUnit(unitId, qid, title) {
    if (!selectedUser) {
      alert('まず参加者を選んでください');
      setScreen('select_user')
      return
    }
    // If we already have an active session for this user and it's for the same unit,
    // reuse it instead of creating a new session. This preserves teaching_by_qid etc.
    if (sessionId && chosenUnitId === unitId) {
      setChosenUnit(title)
      setChosenUnitId(unitId)
      setScreen('chat')
      return
    }
    fetch(`${MOCK_BASE}/start_chat_session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selectedUser, unit_id: unitId, qid })
    }).then(r => {
      if (!r.ok) throw new Error('failed to start session')
      return r.json()
    }).then(data => {
      setSessionId(data.session_id)
      try { localStorage.setItem('session_id', data.session_id); localStorage.setItem('session_user', selectedUser) } catch (e) { }
      setChosenUnit(title)
      setChosenUnitId(unitId)
      setScreen('chat')
    }).catch(err => {
      console.error(err)
      alert('セッション開始に失敗しました')
    })
  }

  function handleUserSelect() {
    // Save current session state before clearing
    const currentSession = {
      sessionId,
      selectedUser,
      chosenUnit,
      chosenUnitId
    }
    // Store in sessionStorage temporarily (survives until browser closed, but not in localStorage to avoid auto-restore)
    try {
      sessionStorage.setItem('temp_session_backup', JSON.stringify(currentSession))
    } catch (e) { }

    // Clear localStorage to prevent automatic session restoration
    try {
      localStorage.removeItem('session_id')
      localStorage.removeItem('session_user')
    } catch (e) { }
    // Clear current session state
    setSessionId(null)
    setSelectedUser(null)
    setChosenUnit(null)
    setChosenUnitId(null)
    // Remember the previous screen before going to user selection
    setPreviousScreen(screen)
    // Navigate to user selection screen
    setScreen('select_user')
  }

  function handleUserSelectCancel() {
    // Restore from sessionStorage backup
    try {
      const backup = sessionStorage.getItem('temp_session_backup')
      if (backup) {
        const parsed = JSON.parse(backup)
        if (parsed.sessionId && parsed.selectedUser) {
          setSessionId(parsed.sessionId)
          setSelectedUser(parsed.selectedUser)
          setChosenUnit(parsed.chosenUnit)
          setChosenUnitId(parsed.chosenUnitId)
          // Restore to localStorage for future auto-restore
          localStorage.setItem('session_id', parsed.sessionId)
          localStorage.setItem('session_user', parsed.selectedUser)
        }
        // Clear the temporary backup
        sessionStorage.removeItem('temp_session_backup')
      }
    } catch (e) { }
    // Go back to previous screen, or 'home' if none
    setScreen(previousScreen || 'home')
    setPreviousScreen(null)
  }

  return (
    <div className="app-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={getManabeeAvatar()} alt="manabee" style={{ width: 48, height: 48 }} />
        <div>
          <h3 style={{ margin: 0 }}>マナビー</h3>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Python の学習を支援するエージェント {overallProgress > 0 && `(進捗: ${overallProgress}%)`}</div>
        </div>
      </div>
      <div className="page-body">
        {screen === 'home' && <Home userId={selectedUser} onStart={() => startUnit('python_basic', null, 'Python学習')} />}
        {screen === 'select_user' && <UserSelector onChoose={(user_id) => { setSelectedUser(user_id); setScreen('home') }} onBack={previousScreen ? handleUserSelectCancel : null} />}
        {screen === 'unit' && <UnitSelector userId={selectedUser} onChoose={(unit, qid, title) => startUnit(unit, qid, title)} onBack={() => setScreen('home')} />}
        {screen === 'chat' && <ChatTestScreen sessionId={sessionId} setSessionId={setSessionId} unitTitle={chosenUnit} unitId={chosenUnitId} onBack={() => setScreen('home')} onUserSelect={handleUserSelect} />}
      </div>
    </div>
  )
}
