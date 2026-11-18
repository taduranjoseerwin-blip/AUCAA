import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/ConfirmModal'

const resolveUploadPath = (p) => {
  if (!p) return null
  return p.startsWith('/uploads/') ? p : `/uploads/${p}`
}

// ── Player Profile Modal ──────────────────────────────────────
function PlayerProfile({ player, onClose }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tempPreviewUrl, setTempPreviewUrl] = useState(null)
  const [playerData, setPlayerData] = useState(player)
  const isAdmin = user?.role === 'admin'
  const [editingBio, setEditingBio] = useState(false)
  const [bioForm, setBioForm] = useState({})
  const [savingBio, setSavingBio] = useState(false)
  const [confirmState, setConfirmState] = useState(null)

  useEffect(() => {
    axios.get(`/api/players/${player.player_id}/stats`)
      .then(r => { setStats(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [player.player_id])

  const initials = playerData.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handlePictureUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // For non-admins, show temporary preview only
    if (!isAdmin) {
      const tempUrl = URL.createObjectURL(file)
      setTempPreviewUrl(tempUrl)
      setTimeout(() => {
        setTempPreviewUrl(null)
        URL.revokeObjectURL(tempUrl)
      }, 3000)
      return
    }

    // Admin: persist the upload
    setUploading(true)
    const formData = new FormData()
    formData.append('picture', file)

    try {
      const res = await axios.post(`/api/uploads/player/${playerData.player_id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      // Server stores DB path as 'players/<filename>' and returns 'picture_url' and 'filename'.
      // Save the DB-relative path so frontend consistently uses `/uploads/${profile_picture}`.
      setPlayerData({
        ...playerData,
        profile_picture: `players/${res.data.filename}`
      })
      alert('Picture uploaded successfully!')
    } catch (err) {
      alert('Failed to upload picture: ' + (err.response?.data?.message || err.message))
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePicture = async () => {
    if (!playerData.profile_picture) return
    if (!isAdmin) {
      alert('Only admins can remove pictures.')
      return
    }
    setConfirmState({
      title: 'Remove picture',
      message: 'Remove player picture?',
      confirmText: 'Remove',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        setConfirmState(null)
        setUploading(true)
        try {
          await axios.delete(`/api/uploads/player/${playerData.player_id}`)
          setPlayerData({
            ...playerData,
            profile_picture: null
          })
          alert('Picture removed successfully!')
        } catch (err) {
          alert('Failed to remove picture: ' + (err.response?.data?.message || err.message))
        } finally {
          setUploading(false)
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  return (
    <div onClick={handleBackdrop} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title || 'Confirm action'}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText || 'Confirm'}
        tone={confirmState?.tone || 'warning'}
        icon={confirmState?.icon || 'ti-alert-circle'}
        onConfirm={confirmState?.onConfirm || (() => setConfirmState(null))}
        onClose={confirmState?.onClose || (() => setConfirmState(null))}
      />
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto'
      }}>

        {/* Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0a00 0%, #2d1200 50%, #1e2330 100%)',
          padding: '28px 28px 20px', position: 'relative', borderRadius: '14px 14px 0 0'
        }}>

          {/* Watermark */}
          <div style={{
            position: 'absolute', right: 28, top: 16, fontSize: 52, fontWeight: 900,
            color: 'rgba(249,115,22,0.08)', letterSpacing: 2, textTransform: 'uppercase',
            lineHeight: 1, userSelect: 'none', overflow: 'hidden', maxWidth: 360
          }}>
            {player.name.split(' ').slice(-1)[0]}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
            <div style={{
              position: 'relative',
              width: 80, height: 80, borderRadius: 12,
              background: 'var(--orange-glow)', border: '2px solid var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: 'var(--orange)', flexShrink: 0,
              overflow: 'hidden',
              cursor: isAdmin ? 'pointer' : 'default',
              pointerEvents: isAdmin ? 'auto' : 'none'
            }}>
              {tempPreviewUrl ? (
                <img 
                  src={tempPreviewUrl}
                  alt="temp preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
                />
              ) : playerData.profile_picture ? (
                <img 
                  src={resolveUploadPath(playerData.profile_picture)}
                  alt={playerData.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                initials
              )}
              {isAdmin && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePictureUpload}
                  disabled={uploading}
                  style={{
                    position: 'absolute', inset: 0, opacity: 0, cursor: uploading ? 'not-allowed' : 'pointer'
                  }}
                  title="Click to upload a player picture"
                />
              )}
              {playerData.profile_picture && isAdmin && (
                <button
                  onClick={handleRemovePicture}
                  disabled={uploading}
                  style={{
                    position: 'absolute', top: -8, right: -8,
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#ef4444', border: 'none',
                    color: 'white', fontSize: 14, fontWeight: 700,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0.8, transition: 'opacity 0.15s',
                    zIndex: 10
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
                >
                  ×
                </button>
              )}
              {tempPreviewUrl && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'white', fontWeight: 600, textAlign: 'center', padding: 4
                }}>
                  Preview
                </div>
              )}
              {uploading && !tempPreviewUrl && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'white', fontWeight: 600
                }}>
                  ⏳
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                {playerData.team_name} | #{playerData.jersey_number || '—'} | {playerData.position || '—'}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, textTransform: 'uppercase' }}>
                {playerData.name.split(' ')[0]}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--orange)', lineHeight: 1.1, textTransform: 'uppercase' }}>
                {playerData.name.split(' ').slice(1).join(' ')}
              </div>
            </div>
          </div>

          {/* Quick stat bar */}
          {!loading && stats && (
            <div style={{
              display: 'flex', gap: 0, marginTop: 20,
              background: 'rgba(0,0,0,0.3)', borderRadius: 10, overflow: 'hidden'
            }}>
              {[
                { label: 'PPG', value: stats.ppg ?? '0.0',                        color: 'var(--orange)' },
                { label: 'RPG', value: stats.rpg ?? '0.0',                        color: '#38bdf8' },
                { label: 'APG', value: stats.apg ?? '0.0',                        color: '#4ade80' },
                { label: 'SPG', value: stats.spg ?? '0.0',                        color: '#f472b6' },
                { label: 'BPG', value: stats.bpg ?? '0.0',                        color: '#a78bfa' },
                { label: 'FG%', value: stats.fg_pct ? `${stats.fg_pct}%` : '0%', color: '#fbbf24' },
              ].map((s, i) => (
                <div key={s.label} style={{
                  flex: 1, textAlign: 'center', padding: '12px 8px',
                  borderRight: i < 5 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '0 28px 28px' }}>

          {/* Info grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            borderBottom: '1px solid var(--border)', padding: '14px 0'
          }}>
            {[
              { label: 'Jersey',      value: playerData.jersey_number ? `#${playerData.jersey_number}` : '—' },
              { label: 'Position',    value: playerData.position || '—' },
              { label: 'Team',        value: playerData.team_name || '—' },
            ].map(item => (
              <div key={item.label} style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {(user?.role === 'league_manager' || user?.role === 'coach') && playerData.verification_status === 'verified' && (
            <div style={{
              margin: '16px 0', padding: '14px 16px', borderRadius: 14,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
              color: '#166534'
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Verified player</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Assigned to {playerData.team_name || 'a team'}.</div>
              {playerData.verified_at && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Verified on {new Date(playerData.verified_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}.
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {['stats', 'bio'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: '12px 20px', fontSize: 13, fontWeight: 600,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: activeTab === t ? 'var(--orange)' : 'var(--text-muted)',
                borderBottom: activeTab === t ? '2px solid var(--orange)' : '2px solid transparent',
                textTransform: 'capitalize', transition: 'all 0.15s'
              }}>{t}</button>
            ))}
          </div>

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <div>
              {loading && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading stats...</div>}
              {!loading && !stats && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No stats available yet.</div>}
              {!loading && stats && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                    Career Stats — Per Game
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--bg-panel)' }}>
                        <tr>
                          {['GP','PTS','REB','AST','STL','BLK','FOULS','TO','FG%','FT%'].map((h, i) => (
                            <th key={h} style={{
                              padding: '10px 12px', fontSize: 10, fontWeight: 700,
                              color: ['PTS','REB','AST','STL','BLK'].includes(h)
                                ? ['var(--orange)','#38bdf8','#4ade80','#f472b6','#a78bfa'][['PTS','REB','AST','STL','BLK'].indexOf(h)]
                                : 'var(--text-muted)',
                              textTransform: 'uppercase', letterSpacing: '0.6px',
                              textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap'
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {[
                            stats.games_played ?? 0,
                            stats.ppg ?? '0.0',
                            stats.rpg ?? '0.0',
                            stats.apg ?? '0.0',
                            stats.spg ?? '0.0',
                            stats.bpg ?? '0.0',
                            stats.total_fouls ?? 0,
                            stats.total_turnovers ?? 0,
                            stats.fg_pct ? `${stats.fg_pct}%` : '0%',
                            stats.ft_pct ? `${stats.ft_pct}%` : '0%',
                          ].map((val, i) => (
                            <td key={i} style={{
                              padding: '12px', textAlign: 'center', fontSize: 14, fontWeight: 700,
                              color: i===1?'var(--orange)':i===2?'#38bdf8':i===3?'#4ade80':i===4?'#f472b6':i===5?'#a78bfa':'var(--text)'
                            }}>{val}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Career totals */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>Career Totals</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {[
                        { label: 'Total Points',   value: stats.total_points ?? 0,    color: 'var(--orange)' },
                        { label: 'Total Rebounds', value: stats.total_rebounds ?? 0,  color: '#38bdf8' },
                        { label: 'Total Assists',  value: stats.total_assists ?? 0,   color: '#4ade80' },
                        { label: 'Total Steals',   value: stats.total_steals ?? 0,    color: '#f472b6' },
                        { label: 'Total Blocks',   value: stats.total_blocks ?? 0,    color: '#a78bfa' },
                        { label: 'Total Fouls',    value: stats.total_fouls ?? 0,     color: '#ef4444' },
                        { label: 'Turnovers',      value: stats.total_turnovers ?? 0, color: 'var(--text-muted)' },
                        { label: 'Games Played',   value: stats.games_played ?? 0,    color: 'var(--text)' },
                      ].map(item => (
                        <div key={item.label} style={{
                          background: 'var(--bg-panel)', border: '1px solid var(--border)',
                          borderRadius: 8, padding: '10px 12px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* BIO TAB */}
          {activeTab === 'bio' && (
            <div>
              {isAdmin && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 8 }}>
                  {!editingBio && <button onClick={() => {
                    const rawDob = playerData.date_of_birth || ''
                    const toIso = (val) => {
                      if (!val) return ''
                      // If already ISO yyyy-mm-dd
                      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
                      // If dd/mm/yyyy -> convert
                      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
                        const parts = val.split('/')
                        const dd = parts[0].padStart(2,'0')
                        const mm = parts[1].padStart(2,'0')
                        const yyyy = parts[2]
                        return `${yyyy}-${mm}-${dd}`
                      }
                      // last resort, try Date parse
                      const d = new Date(val)
                      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10)
                    }

                    setBioForm({
                      name: playerData.name || '',
                      date_of_birth: toIso(rawDob),
                      height: playerData.height || '',
                      weight: playerData.weight || '',
                      barangay: playerData.barangay || '',
                      student_id: playerData.student_id || '',
                      jersey_number: playerData.jersey_number || '',
                      position: playerData.position || ''
                    })
                    setEditingBio(true)
                  }} style={{ padding: '8px 12px', fontSize: 12 }}>Edit Bio</button>}
                  {editingBio && <>
                    <button onClick={() => { setEditingBio(false); setBioForm({}) }} style={{ padding: '8px 12px', fontSize: 12 }}>Cancel</button>
                    <button onClick={async () => {
                      setSavingBio(true)
                      try {
                            const payload = { ...bioForm }
                            // normalize date formats: accept dd/mm/yyyy and convert
                            if (payload.date_of_birth && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(payload.date_of_birth)) {
                              const [d, m, y] = payload.date_of_birth.split('/')
                              payload.date_of_birth = `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
                            }
                            if (payload.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(payload.date_of_birth)) {
                              // try parseable formats
                              const dd = new Date(payload.date_of_birth)
                              if (!isNaN(dd.getTime())) payload.date_of_birth = dd.toISOString().slice(0,10)
                            }
                        // convert empty strings to null where appropriate
                        for (const k of ['date_of_birth','height','weight','barangay','student_id','jersey_number','position','name']) {
                          if (payload[k] === '') payload[k] = null
                        }
                        const res = await axios.patch(`/api/admin/players/${playerData.player_id}`, payload)
                        setPlayerData(prev => ({ ...prev, ...res.data }))
                        setEditingBio(false)
                      } catch (err) {
                        alert(err.response?.data?.message || 'Failed to save bio.')
                      } finally {
                        setSavingBio(false)
                      }
                    }} disabled={savingBio} style={{ padding: '8px 12px', fontSize: 12 }}>{savingBio ? 'Saving...' : 'Save'}</button>
                  </>}
                </div>
              )}

              {editingBio ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Full Name</div>
                    <input value={bioForm.name} onChange={e => setBioForm(f => ({...f, name: e.target.value}))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Date of Birth</div>
                    <input type="date" value={bioForm.date_of_birth} onChange={e => setBioForm(f => ({...f, date_of_birth: e.target.value}))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Height</div>
                    <input value={bioForm.height} onChange={e => setBioForm(f => ({...f, height: e.target.value}))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Weight</div>
                    <input value={bioForm.weight} onChange={e => setBioForm(f => ({...f, weight: e.target.value}))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Barangay</div>
                    <input value={bioForm.barangay} onChange={e => setBioForm(f => ({...f, barangay: e.target.value}))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Student ID</div>
                    <input value={bioForm.student_id} onChange={e => setBioForm(f => ({...f, student_id: e.target.value}))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Jersey Number</div>
                    <input type="number" value={bioForm.jersey_number} onChange={e => setBioForm(f => ({...f, jersey_number: e.target.value}))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Position</div>
                    <input value={bioForm.position} onChange={e => setBioForm(f => ({...f, position: e.target.value}))} style={{ width: '100%' }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  {[                
                    { label: 'Full Name',     value: playerData.name },
                    { label: 'Date of Birth', value: playerData.date_of_birth ? new Date(playerData.date_of_birth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not provided' },
                    { label: 'Height',        value: playerData.height || 'Not provided' },
                    { label: 'Weight',        value: playerData.weight || 'Not provided' },
                    { label: 'Barangay',      value: playerData.barangay || 'Not provided' },
                    { label: 'Student ID',    value: playerData.student_id || 'Not provided' },
                    { label: 'Team',          value: playerData.team_name || '—' },
                    { label: 'Jersey Number', value: playerData.jersey_number ? `#${playerData.jersey_number}` : '—' },
                    { label: 'Position',      value: playerData.position || '—' },
                    { label: 'Player Type',   value: playerData.is_import ? 'Import Player' : 'Local Player' },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        color: item.label === 'Player Type' && item.value === 'Import Player' ? 'var(--orange)' : 'var(--text)'
                      }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stat Leader Card ─────────────────────────────────────────
function LeaderCard({ rank, player, statLabel, statValue, color, onClick }) {
  const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div onClick={() => onClick(player)} style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer', transition: 'all 0.15s'
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color || 'var(--orange)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-panel)' }}
    >
      <div style={{ width: 24, fontSize: 11, fontWeight: 700, color: rank===1?'#f59e0b':rank===2?'#94a3b8':rank===3?'#cd7c4f':'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>#{rank}</div>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--orange-glow)', border: `1px solid ${color||'var(--orange-dim)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: color||'var(--orange)', flexShrink: 0, overflow: 'hidden' }}>
        {player.profile_picture ? (
          <img 
            src={resolveUploadPath(player.profile_picture)}
            alt={player.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initials
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{player.team_name}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: color||'var(--orange)', lineHeight: 1 }}>{statValue}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{statLabel}</div>
      </div>
    </div>
  )
}

const STAT_TABS = [
  { key: 'points',   label: 'Points',   shortLabel: 'PPG', color: 'var(--orange)' },
  { key: 'rebounds', label: 'Rebounds', shortLabel: 'RPG', color: '#38bdf8' },
  { key: 'assists',  label: 'Assists',  shortLabel: 'APG', color: '#4ade80' },
  { key: 'steals',   label: 'Steals',   shortLabel: 'SPG', color: '#f472b6' },
  { key: 'blocks',   label: 'Blocks',   shortLabel: 'BPG', color: '#a78bfa' },
]

function ViewToggle({ view, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg-panel)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', marginLeft: 'auto' }}>
      {[{ key: 'leaders', icon: 'ti-trophy', label: 'Leaders' }, { key: 'roster', icon: 'ti-users', label: 'Roster' }].map(v => (
        <button key={v.key} onClick={() => onChange(v.key)} type="button" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
          background: view === v.key ? 'var(--orange)' : 'transparent',
          color: view === v.key ? '#fff' : 'var(--text-muted)',
          border: 'none', cursor: 'pointer', transition: 'all 0.15s'
        }}>
          <i className={`ti ${v.icon}`} style={{ fontSize: 13 }} />{v.label}
        </button>
      ))}
    </div>
  )
}

function LeadersSection({ leagueId, view, onViewChange, onPlayerClick }) {
  const [activeTab, setActiveTab] = useState('points')
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leagueId) return
    setLoading(true)
    axios.get(`/api/players/leaders/${leagueId}?category=${activeTab}`)
      .then(r => { setLeaders(r.data.slice(0, 5)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leagueId, activeTab])

  const activeStat = STAT_TABS.find(t => t.key === activeTab)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {STAT_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20,
            border: `1px solid ${activeTab===tab.key ? tab.color : 'var(--border)'}`,
            background: activeTab===tab.key ? `${tab.color}18` : 'transparent',
            color: activeTab===tab.key ? tab.color : 'var(--text-muted)',
            cursor: 'pointer', transition: 'all 0.15s'
          }}>{tab.label}</button>
        ))}
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
      {loading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>}
      {!loading && leaders.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>No stats recorded yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {leaders.map((p, i) => (
          <LeaderCard key={p.player_id} rank={i+1} player={p} statLabel={activeStat.shortLabel} statValue={p.ppg} color={activeStat.color} onClick={onPlayerClick} />
        ))}
      </div>
    </div>
  )
}

function RosterTable({ players, teams, loading, leagueId, view, onViewChange, onPlayerClick }) {
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('all')

  const filtered = players.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.team_name?.toLowerCase().includes(search.toLowerCase())
    const matchTeam = filterTeam === 'all' || p.team_id === Number(filterTeam)
    const matchLeague = !leagueId || Number(p.league_id) === Number(leagueId)
    return matchSearch && matchTeam && matchLeague
  })

  const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle = { padding: '10px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player or team..." style={{ width: '100%', paddingLeft: 32, fontSize: 13 }} />
        </div>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={{ fontSize: 13, padding: '6px 10px', minWidth: 140 }}>
          <option value="all">All Teams</option>
          {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
        </select>
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-panel)' }}>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Player</th>
              <th style={thStyle}>Team</th>
              <th style={thStyle}>Jersey</th>
              <th style={thStyle}>Position</th>
              <th style={{ ...thStyle, color: 'var(--orange)', textAlign: 'center' }}>PTS</th>
              <th style={{ ...thStyle, color: '#38bdf8', textAlign: 'center' }}>REB</th>
              <th style={{ ...thStyle, color: '#4ade80', textAlign: 'center' }}>AST</th>
              <th style={{ ...thStyle, color: '#f472b6', textAlign: 'center' }}>STL</th>
              <th style={{ ...thStyle, color: '#a78bfa', textAlign: 'center' }}>BLK</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Loading players...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={10} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No players found.</td></tr>}
            {filtered.map((p, i) => {
              const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <tr key={p.player_id} onClick={() => onPlayerClick(p)}
                  style={{ transition: 'background 0.1s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--orange-glow)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 11 }}>{i+1}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--orange-glow)', border: '1px solid var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--orange)', flexShrink: 0, overflow: 'hidden' }}>
                        {p.profile_picture ? (
                          <img 
                            src={resolveUploadPath(p.profile_picture)}
                            alt={p.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--orange)' }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.team_name||'—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{p.jersey_number?`#${p.jersey_number}`:'—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.position||'—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: 'var(--orange)' }}>{p.ppg??'—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>{p.rpg??'—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#4ade80' }}>{p.apg??'—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#f472b6' }}>{p.spg??'—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#a78bfa' }}>{p.bpg??'—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Showing {filtered.length} of {players.length} players · Click any player to view full profile
      </div>
    </div>
  )
}

// ── Main Players Page ─────────────────────────────────────────
export default function Players() {
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [leagues, setLeagues] = useState([])
  const [leagueId, setLeagueId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('leaders')
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, tRes, lRes] = await Promise.all([
          axios.get('/api/players'),
          axios.get('/api/teams'),
          axios.get('/api/leagues')
        ])
        setPlayers(pRes.data)
        setTeams(tRes.data)
        const leagueList = lRes.data || []
        setLeagues(leagueList)
        if (leagueList.length > 0) {
          const preferred = leagueList.find((item) => item.status === 'active')
            || leagueList.find((item) => item.status === 'upcoming')
            || leagueList[0]
          setLeagueId(String(preferred.league_id))
        } else if (pRes.data.length > 0) {
          setLeagueId(String(pRes.data[0].league_id || 1))
        }
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {selectedPlayer && <PlayerProfile player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}

      <div className="feed-area">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Players</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {leagues.find((league) => Number(league.league_id) === Number(leagueId))?.name || 'All leagues'} · {players.filter((player) => !leagueId || Number(player.league_id) === Number(leagueId)).length} registered players
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={leagueId || ''}
              onChange={(event) => setLeagueId(event.target.value)}
              style={{ minWidth: 220, padding: '8px 10px', borderRadius: 8, background: '#1e2330', border: '1px solid #ffffff22', color: '#ffffff', cursor: 'pointer' }}
            >
              {leagues.length === 0 && <option value="">Loading leagues...</option>}
              {leagues.map((league) => (
                <option key={league.league_id} value={league.league_id}>
                  {league.name}{league.status ? ` (${league.status})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {view === 'leaders' && <LeadersSection leagueId={leagueId||1} view={view} onViewChange={setView} onPlayerClick={setSelectedPlayer} />}
        {view === 'roster'  && <RosterTable
          players={players}
          teams={teams.filter((team) => !leagueId || Number(team.league_id) === Number(leagueId))}
          loading={loading}
          leagueId={leagueId}
          view={view}
          onViewChange={setView}
          onPlayerClick={setSelectedPlayer}
        />}
      </div>

      <aside className="right-rail">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Stat Categories</div>
          {[{ label:'PPG', desc:'Points Per Game', color:'var(--orange)' },{ label:'RPG', desc:'Rebounds Per Game', color:'#38bdf8' },{ label:'APG', desc:'Assists Per Game', color:'#4ade80' },{ label:'SPG', desc:'Steals Per Game', color:'#f472b6' },{ label:'BPG', desc:'Blocks Per Game', color:'#a78bfa' }].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 32, fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Priority Stats</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>Based on survey of <span style={{ color: 'var(--text)', fontWeight: 600 }}>72 stakeholders</span>:</div>
          {[{ rank:1, label:'Basic Totals (Pts, Reb, Ast)', color:'#f59e0b' },{ rank:2, label:'Defensive Stats (Stl, Blk)', color:'#94a3b8' },{ rank:3, label:'Discipline (Fouls, Techs)', color:'#cd7c4f' }].map(s => (
            <div key={s.rank} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color, width: 16 }}>#{s.rank}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Teams</div>
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 6 }}>
            {teams.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No teams loaded.</div>}
            {teams.map(t => (
              <div key={t.team_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ti ti-shield" style={{ fontSize: 12, color: 'var(--orange)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.team_name}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}