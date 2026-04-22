import React, { useEffect, useState } from 'react'

// Use relative path for Vite dev proxy
const MOCK_BASE = '/mock'

export default function UserSelector({ onChoose, onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let mounted = true
    fetch('/mock/list_users').then(r => r.json()).then(j => {
      if (!mounted) return
      const list = (j && j.users) ? j.users : [{ id: 'demouser', name: 'Demo User' }]
      setUsers(list)
      setSelected(list[0]?.id || list[0]?.user_id || null)
    }).catch(err => {
      console.error('failed to list users', err)
      setUsers([{ id: 'demouser', name: 'Demo User' }])
      setSelected('demouser')
    }).finally(() => setLoading(false))
    return () => mounted = false
  }, [])

  function handleStart() {
    if (!selected) { alert('ユーザを選択してください'); return }
    onChoose && onChoose(selected)
  }

  return (
    <div className="home-container">
      <div className="card">
        <h3>参加者を選択してください</h3>
        {loading ? <div>読み込み中...</div> : (
          <div>
            <select value={selected || ''} onChange={e => setSelected(e.target.value)} style={{ padding: 8, width: '100%' }}>
              {users.map(u => {
                const uid = u.id || u.user_id
                const name = u.name || u.display_name || uid
                return <option key={uid} value={uid}>{name}</option>
              })}
            </select>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {onBack && (
                <button className="btn btn-secondary" onClick={onBack}>キャンセル</button>
              )}
              <button className="btn" onClick={handleStart} style={{ flex: 1 }}>選択して続行</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
