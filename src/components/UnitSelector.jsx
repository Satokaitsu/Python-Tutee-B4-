import React, { useState, useEffect, useCallback } from 'react';
import '../index.css';

// Use proxy-relative paths so Vite forwards /mock to backend
const mockAsset = (name) => `/mock/assets/${name}`;

function UnitSelector({ onChoose, onBack, userId }) {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentProgress, setStudentProgress] = useState(null);
  const subjectInfo = studentProgress?.subjectInfo || { name: '学習', description: '', student_name: 'マナビー' };

  // 進捗に応じたマナビーのアバターを選択
  const getManabeeAvatar = (progress) => {
    if (progress >= 70) return 'manabee-advanced.svg';
    if (progress >= 30) return 'manabee-robot.svg';
    return 'manabee-beginner.svg';
  };

  const getGrowthStatus = (progress) => {
    if (progress >= 90) return { message: 'とても得意になりました！内容のつながりもよく分かります！', avatar: mockAsset('manabee-advanced.svg') };
    if (progress >= 70) return { message: 'かなり理解が深まってきました！複雑な内容も分かるようになりました！', avatar: mockAsset('manabee-advanced.svg') };
    if (progress >= 50) return { message: '楽しくなってきました！もっと色々な内容を学びたいですね。', avatar: mockAsset('manabee-robot.svg') };
    if (progress >= 30) return { message: '基本的なしくみが分かってきました！もう少し頑張ります！', avatar: mockAsset('manabee-robot.svg') };
    return { message: '学習は初めて本格的に学びますが、頑張って勉強します！', avatar: mockAsset('manabee-beginner.svg') };
  };

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch(`/mock/list_units${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`);
      const j = await res.json();

      // Filter to the three core Python units for this demo and enforce order/title
      const allUnits = j.units || [];
      const allowed = ['cond', 'loop', 'func'];
      const titleMap = { cond: '条件分岐', loop: 'ループ', func: '関数' };
      // normalize unit objects to include unit_id
      const norm = allUnits.map(u => ({
        unit_id: u.unit_id || u.id || (typeof u === 'string' ? u : undefined),
        title: u.title || u.name || u.unit_title || '',
        description: u.description || u.summary || '' ,
        difficulty: u.difficulty || '入門',
        questions: u.questions || []
      }));
      // select only allowed
      let filtered = norm.filter(u => allowed.includes(u.unit_id));
      // if none found (fallback), try deriving by qid prefix via questions
      if (filtered.length === 0) {
        filtered = norm.filter(u => {
          const q0 = Array.isArray(u.questions) && u.questions[0];
          if (!q0) return false;
          return allowed.some(a => q0.startsWith(a + '_'));
        });
      }
      // attach friendly Japanese titles and desired order
      filtered.forEach(u => { if (titleMap[u.unit_id]) u.title = titleMap[u.unit_id]; });
      filtered.sort((a,b) => allowed.indexOf(a.unit_id) - allowed.indexOf(b.unit_id));
      setUnits(filtered);

      // normalize progress similar to Home
      if (j && (j.units || (j.progress && j.progress.units))) {
        const unitsArr = j.units || j.progress.units || [];
        const percents = unitsArr.map(u => (u.percent_known != null ? u.percent_known : 0));
        const overall = percents.length ? Math.round(percents.reduce((a,b)=>a+b,0)/percents.length) : 0;
        const detailed = {};
        unitsArr.forEach(u => {
          const unitId = u.unit_id || u.unit || (u.qid && u.qid.split('_')[0]) || null;
          const title = u.title || titleMap[unitId] || unitId || '単元';
          detailed[title] = { understanding_level: u.percent_known || 0, unit_id: unitId };
          // also keep raw id-keyed entry for robust lookups
          if (unitId) detailed[unitId] = { understanding_level: u.percent_known || 0, unit_id: unitId };
        });
        setStudentProgress({ overall_progress: overall, detailed_progress: detailed, units: unitsArr });
      } else if (j.progress) {
        setStudentProgress(j.progress);
      }
    } catch (err) {
      console.error('Failed to fetch units from mock server', err);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleStartLearning = async () => {
    if (!selectedUnit) {
      alert('学習したい単元を選択してください');
      return;
    }

    // onChoose expects: (unit_id, first_qid, title)
    const unit = units.find(u => u.id === selectedUnit || u.unit_id === selectedUnit) || units.find(u => u.unit_id === selectedUnit);
    if (!unit) {
      alert('選択した単元が見つかりません');
      return;
    }
    const firstQ = Array.isArray(unit.questions) && unit.questions.length ? unit.questions[0] : null;
    onChoose && onChoose(unit.unit_id || unit.id, firstQ, unit.title || unit.name || '');
  };

  const getProgressColor = (level) => {
    if (level >= 80) return '#4CAF50'; // 緑
    if (level >= 60) return '#FFC107'; // 黄
    if (level >= 40) return '#FF9800'; // オレンジ
    return '#F44336'; // 赤
  };

  const getDifficultyIcon = (difficulty) => {
    switch (difficulty) {
      case '入門': return '🔰';
      case '初級': return '🌱';
      case '中級': return '⭐';
      case '上級': return '🏆';
      default: return '📚';
    }
  };

  if (loading) {
    return (
      <div className="learning-container">
        <div className="card">
          <h2>単元情報を読み込み中...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="learning-container">
      <div className="card">
        <h2>📚 マナビー - 学習単元選択</h2>
        
        {/* 全体的な進捗表示 */}
        {studentProgress && (
          <div style={{ 
            marginBottom: '20px', 
            padding: '15px', 
            background: '#f0f8ff', 
            borderRadius: '8px' 
          }}>
            <h3>🤖 マナビーの現在の状況</h3>
            <div style={{ marginBottom: '10px' }}>
              <strong>総合理解度: {studentProgress.overall_progress}%</strong>
              <div style={{ 
                width: '100%', 
                height: '20px', 
                background: '#e0e0e0', 
                borderRadius: '10px',
                marginTop: '5px'
              }}>
                <div style={{
                  width: `${studentProgress.overall_progress}%`,
                  height: '100%',
                  background: getProgressColor(studentProgress.overall_progress),
                  borderRadius: '10px',
                  transition: 'width 0.5s ease'
                }}></div>
              </div>
            </div>
          </div>
        )}

        <div className="intro-bubble">
          <img src={getGrowthStatus(studentProgress?.overall_progress || 0).avatar} alt="マナビー" style={{ width: 64, height: 64, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{subjectInfo?.student_name || 'マナビー'}</div>
            <div style={{ color: '#6b5a47' }}>{getGrowthStatus(studentProgress?.overall_progress || 0).message}</div>
          </div>
        </div>

        <div style={{ margin: '20px 0' }}>
          {units.map(unit => {
            // 学習者別の進捗データを取得: prefer units array, fall back to detailed_progress by title
            const byUnits = studentProgress?.units && Array.isArray(studentProgress.units)
              ? (studentProgress.units.find(u => u.unit_id === (unit.unit_id || unit.id)) || {})
              : null;
            let userProgress = 0;
            if (byUnits && byUnits.percent_known != null) {
              userProgress = byUnits.percent_known;
            } else {
              // Try multiple fallback keys: displayed title (日本語), unit_id, raw id
              const titleKey = unit.title || (titleMap && titleMap[unit.unit_id]) || unit.unit_id || unit.id;
              userProgress = studentProgress?.detailed_progress?.[titleKey]?.understanding_level
                ?? studentProgress?.detailed_progress?.[unit.unit_id]?.understanding_level
                ?? studentProgress?.detailed_progress?.[unit.id]?.understanding_level
                ?? 0;
            }
            const progress = userProgress;
            console.log(`📊 単元${unit.id}の進捗:`, progress, 'studentProgress:', studentProgress);
            const isCompleted = progress >= 80;
            const isInProgress = progress > 0 && progress < 80;
            
            return (
                <div 
                key={unit.unit_id || unit.id}
                style={{
                  border: selectedUnit === (unit.unit_id || unit.id) ? '2px solid #b48836' : '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  backgroundColor: selectedUnit === unit.id ? '#fffbe7' : '#fff',
                  position: 'relative'
                }}
                onClick={() => {
                  const uid = unit.unit_id || unit.id;
                  console.log('📋 単元カード全体がクリックされました:', uid);
                  setSelectedUnit(uid);
                }}
              >
                {/* ステータスバッジ */}
                {isCompleted && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: '#4CAF50',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    ✅ 完了
                  </div>
                )}
                {isInProgress && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: '#FF9800',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    学習中
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                    type="radio"
                    checked={selectedUnit === (unit.unit_id || unit.id)}
                    onChange={() => {
                      const uid = unit.unit_id || unit.id;
                      console.log('🔘 ラジオボタンがクリックされました:', uid);
                      setSelectedUnit(uid);
                    }}
                    style={{ marginRight: '10px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      {getDifficultyIcon(unit.difficulty)} {unit.title || unit.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                      {unit.description || unit.summary || ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      難易度: {unit.difficulty || '-'} | 所要時間: {unit.estimated_time || '-'}
                    </div>
                    
                    {/* 進捗バー */}
                    {progress > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          理解度: {progress}%
                        </div>
                        <div style={{ 
                          width: '100%', 
                          height: '6px', 
                          background: '#e0e0e0', 
                          borderRadius: '3px',
                          marginTop: '2px'
                        }}>
                          <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: getProgressColor(progress),
                            borderRadius: '3px'
                          }}></div>
                        </div>
                      </div>
                    )}
                    
                    {/* 習熟度テスト機能は本バージョンで不要のため削除 */}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="button-row" style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={onBack}>
            ホームに戻る
          </button>
          <button 
            className="btn" 
            onClick={handleStartLearning}
            disabled={!selectedUnit}
          >
            学習を始める
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnitSelector;
