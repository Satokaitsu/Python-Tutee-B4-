import React, { useState, useEffect } from 'react';
import '../index.css';

// Use relative path for Vite dev proxy
const MOCK_BASE = '/mock'
// helper to build asset paths; use relative `/mock/assets/...` so Vite dev
// server can proxy them to the backend and avoid CORS during development.
const mockAsset = (name) => `/mock/assets/${name}`;

const UNIT_TITLE_MAP = {
  'cond': '条件分岐',
  'loop': 'ループ',
  'func': '関数'
}

function Home({ userId, onStart }) {
  const [loading, setLoading] = useState(false);
  const [studentProgress, setStudentProgress] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(true);
  // Ensure a subjectInfo object exists to avoid runtime ReferenceError in rendering.
  const subjectInfo = studentProgress?.subjectInfo || { name: '学習', student_name: 'マナビー' };

  // 学習進捗データを取得：userId が渡されたら /mock/progress/{userId} を使う
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        let j = null
        if (userId) {
          const res = await fetch(`/mock/progress/${encodeURIComponent(userId)}`)
          j = await res.json()
          // backend may return { user_id, progress: { units: [...] } }
          if (j && j.progress) {
            const prog = j.progress
            const unitsArr = prog.units || []
            const percents = unitsArr.map(u => (u.percent_known != null ? u.percent_known : 0))
            const overall = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0
            const detailed = {}
            unitsArr.forEach(u => {
              const unitId = u.unit_id || u.unit || (u.qid && u.qid.split('_')[0]) || null;
              const title = UNIT_TITLE_MAP[unitId] || u.title || unitId || '単元';
              detailed[title] = { understanding_level: u.percent_known || 0, unit_id: unitId };
            })
            setStudentProgress({ overall_progress: overall, detailed_progress: detailed, units: unitsArr })
            return
          }
        }

        // fallback: query list_units as before
        const res2 = await fetch(`/mock/list_units${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`)
        const j2 = await res2.json()
        if (j2 && (j2.units || (j2.progress && j2.progress.units))) {
          const unitsArr = j2.units || j2.progress.units || []
          const percents = unitsArr.map(u => (u.percent_known != null ? u.percent_known : 0))
          const overall = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0
          const detailed = {};
          unitsArr.forEach(u => {
            const unitId = u.unit_id || u.unit || (u.qid && u.qid.split('_')[0]) || null;
            const title = UNIT_TITLE_MAP[unitId] || u.title || unitId || '単元';
            detailed[title] = { understanding_level: u.percent_known || 0, unit_id: unitId };
          });
          setStudentProgress({ overall_progress: overall, detailed_progress: detailed, units: unitsArr });
        } else if (j2.progress) {
          setStudentProgress(j2.progress)
        } else {
          setStudentProgress({ overall_progress: 0, detailed_progress: {} })
        }
      } catch (err) {
        console.error('Failed to fetch progress from mock server', err)
        setStudentProgress({ overall_progress: 0, detailed_progress: {} })
      } finally {
        setLoadingProgress(false)
      }
    }
    fetchProgress()
  }, [userId]);

  // ユーザー表示名の取得
  const [userName, setUserName] = useState(userId || '');
  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const res = await fetch('/mock/list_users');
        const data = await res.json();
        const found = data.users?.find(u => u.user_id === userId);
        if (found && found.display_name) {
          setUserName(found.display_name);
        } else {
          setUserName(userId);
        }
      } catch (e) {
        setUserName(userId);
      }
    };
    fetchUser();
  }, [userId]);

  const handleStart = async () => {
    setLoading(true);
    try {
      // Home は単に Unit 選択画面へ遷移するトリガーを提供
      onStart && onStart('unit');
    } catch (err) {
      console.error(err);
      alert('画面遷移中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // 成長レベルを計算（0-100の進捗を1-10のレベルに変換）
  const getGrowthLevel = (progress) => {
    return Math.min(Math.floor(progress / 10) + 1, 10);
  };

  // 理解度に応じたプログレスバーの色を取得
  const getProgressBarColor = (progress) => {
    if (progress >= 80) return '#28a745'; // 緑（優秀）
    if (progress >= 60) return '#17a2b8'; // 青（良好）
    if (progress >= 40) return '#ffc107'; // 黄（成長中）
    if (progress >= 20) return '#fd7e14'; // オレンジ（要努力）
    return '#dc3545'; // 赤（初心者）
  };

  // 成長段階に応じたメッセージとマナビーの表情
  const getGrowthStatus = (progress) => {
    const subjectName = subjectInfo?.name || '学習';
    if (progress >= 90) return {
      level: 'エキスパート',
      message: `プログラミングがとても得意になりました！内容のつながりもよく分かります！`,
      emoji: '🏆',
      color: '#ff6b6b',
      avatar: mockAsset('manabee-robot.svg')
    };
    if (progress >= 70) return {
      level: '上級者',
      message: `かなり理解が深まってきました！複雑なプログラミングの内容も分かるようになりました！`,
      emoji: '🌟',
      color: '#4ecdc4',
      avatar: mockAsset('manabee-robot.svg')
    };
    if (progress >= 50) return {
      level: '中級者',
      message: `プログラミングが楽しくなってきました！もっと色々な内容を学びたいです！`,
      emoji: '😊',
      color: '#45b7d1',
      avatar: mockAsset('manabee-robot.svg')
    };
    if (progress >= 30) return {
      level: '初級者',
      message: `基本的なプログラミングのしくみが分かってきました！もう少し頑張ります！`,
      emoji: '🌱',
      color: '#96ceb4',
      avatar: mockAsset('manabee-robot.svg')
    };
    return {
      level: '初心者',
      message: `プログラミングは初めて本格的に学びますが、頑張って勉強します！`,
      emoji: '🔰',
      color: '#feca57',
      avatar: mockAsset('manabee-robot.svg')
    };
  };

  if (loadingProgress) {
    return (
      <div className="home-container">
        <div className="card">
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div>AI生徒の成長データを読み込み中...</div>
          </div>
        </div>
      </div>
    );
  }

  const currentProgress = studentProgress?.overall_progress || 0;
  const growthStatus = getGrowthStatus(currentProgress);
  const growthLevel = getGrowthLevel(currentProgress);
  const unitsStudied = studentProgress?.units_studied || 0;

  return (
    <div className="home-container">
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#b48836' }}>
          {/* {subjectInfo?.name || '学習'}サポートシステム */}
          Python-Tutee
        </h2>

        <div style={{ textAlign: 'center', marginBottom: '20px', color: '#666', fontSize: '1.1em' }}>
          ログイン中: <strong>{userName}</strong>
        </div>



        <div className="intro-bubble" style={{ marginTop: '18px' }}>
          <img src={growthStatus.avatar} alt="マナビー" style={{ width: 64, height: 64, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{subjectInfo?.student_name || 'マナビー'}</div>
            <div style={{ color: '#6b5a47' }}>{growthStatus.message}</div>
          </div>
        </div>

        {/* 詳細な学習統計 */}
        {studentProgress?.detailed_progress && Object.keys(studentProgress.detailed_progress).length > 0 && (
          <div style={{
            margin: '20px 0',
            padding: '15px',
            background: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            <strong>📊 学習の詳細</strong>
            <div style={{ marginTop: '10px' }}>
              {Object.entries(studentProgress.detailed_progress).slice(0, 3).map(([unit, data], index) => (
                <div key={unit} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  padding: '8px',
                  background: 'white',
                  borderRadius: '4px',
                  border: '1px solid #e9ecef'
                }}>
                  <span>{unit}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      background: '#f8f9fa',
                      borderRadius: '10px',
                      padding: '2px 8px',
                      border: `2px solid ${getProgressBarColor(data.understanding_level)}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getProgressBarColor(data.understanding_level)
                      }}></div>
                      <span style={{
                        color: getProgressBarColor(data.understanding_level),
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}>
                        {data.understanding_level}%
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      ✨新概念{Math.floor(data.understanding_level / 20)}個習得
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(studentProgress.detailed_progress).length > 3 && (
                <div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
                  他 {Object.keys(studentProgress.detailed_progress).length - 3} 単元...
                </div>
              )}
            </div>
          </div>
        )}

        {/* <div style={{ 
          margin: '20px 0', 
          padding: '15px', 
          background: '#f0f8ff', 
          borderRadius: '8px', 
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          <strong>👨‍🏫 あなたの役割：</strong><br/>
          🔬 マナビーのMatlab基礎の質問に答えて教える<br/>
          💡 分かりやすいMatlab基礎のしくみと具体例を提供<br/>
          📝 マナビーにテストを受けさせてMatlabの理解度を確認<br/>
          🎯 ループや配列操作分野の学習をサポート
        </div> */}

        <div style={{ marginTop: 18, textAlign: 'left' }}>
          <button className="btn" onClick={handleStart} disabled={loading}>
            {loading ? '接続中...' : '学習を始める'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;