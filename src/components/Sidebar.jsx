import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [liveGames, setLiveGames] = useState([])

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await axios.get('/api/games?status=live')
        setLiveGames(res.data.slice(0, 3))
      } catch (_) {}
    }
    fetchGames()
    const interval = setInterval(fetchGames, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside style={{
      width: 200, background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0
    }}>
      {/* Logo */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--orange)' }}>AUCAA</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Basketball League System</div>
      </div>

      {/* Live games */}
      {liveGames.length > 0 && (
        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 16px 6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Live Now</div>
          {liveGames.map(g => (
            <div key={g.game_id} onClick={() => navigate(`/game/${g.game_id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <div className="live-pulse" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.home_team_name?.split(' ')[0]} vs {g.away_team_name?.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom: user */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', padding: '8px 0' }}>
        {user ? (
          <>
            <div style={{ padding: '6px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
              <div style={{ color: 'var(--text)', fontWeight: 600 }}>{user.username}</div>
              <div style={{ fontSize: 10, textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</div>
            </div>
            <button onClick={() => navigate('/settings')} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '6px 16px', fontSize: 12,
              background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer'
            }}>
              <i className="ti ti-settings" aria-hidden="true" style={{ fontSize: 14 }} />
              Settings
            </button>
            <button onClick={logout} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '6px 16px', fontSize: 12,
              background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer'
            }}>
              <i className="ti ti-logout" aria-hidden="true" style={{ fontSize: 14 }} />
              Logout
            </button>
          </>
        ) : null}
      </div>
    </aside>
  )
}