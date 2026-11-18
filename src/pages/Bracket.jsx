import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { io } from 'socket.io-client'
import BracketSVG from '../components/BracketSVG'
import ConfirmModal from '../components/ConfirmModal'

export default function Bracket() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'league_manager'
  const [leagueId, setLeagueId] = useState('')
  const [leagueOptions, setLeagueOptions] = useState([])
  const [league, setLeague] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState(null)
  const [bracketSize, setBracketSize] = useState(2)
  const [teamCount, setTeamCount] = useState(0)
  const [notification, setNotification] = useState(null)

  const showNotification = (type, message) => {
    setNotification({ type, message })
  }

  useEffect(() => {
    if (!notification) return undefined
    const timer = window.setTimeout(() => setNotification(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const res = await axios.get('/api/leagues')
        const leagues = res.data || []
        setLeagueOptions(leagues)

        if (!leagueId && leagues.length > 0) {
          const preferred = leagues.find(l => l.status === 'active') || leagues.find(l => l.status === 'upcoming') || leagues[0]
          setLeagueId(String(preferred.league_id))
        }
      } catch (err) {
        console.error('Failed to load leagues:', err)
      }
    }

    loadLeagues()
  }, [])

  useEffect(() => {
    if (leagueId) load()
  }, [leagueId])

  // Socket.IO: subscribe to bracket updates
  const socketRef = useRef(null)
  useEffect(() => {
    socketRef.current = io()
    socketRef.current.on('connect', () => {})
    socketRef.current.on('bracketUpdated', (payload) => {
      if (payload?.league_id === leagueId) {
        setGames(payload.games || [])
      }
    })
    return () => { socketRef.current?.disconnect() }
  }, [leagueId])

  const load = async () => {
    setLoading(true)
    try {
      const [leagueRes, bracketRes, teamsRes] = await Promise.all([
        axios.get(`/api/leagues/${leagueId}`),
        axios.get(`/api/bracket/${leagueId}`),
        axios.get(`/api/teams?league_id=${leagueId}`)
      ])
      setLeague(leagueRes.data)
      setGames(bracketRes.data)
      setTeamCount(Array.isArray(teamsRes.data) ? teamsRes.data.length : 0)
    } catch (err) {
      console.error('Failed to load bracket or league', err)
      setLeague(null)
      setGames([])
      setTeamCount(0)
    } finally { setLoading(false) }
  }

  const groupedByRound = () => {
    const map = {}
    games.forEach(g => {
      const r = g.bracket_round || 0
      if (!map[r]) map[r] = []
      map[r].push(g)
    })
    const keys = Object.keys(map).map(Number).sort((a,b)=>a-b)
    return { map, keys }
  }

  const handleGenerate = async () => {
    if (league?.format === 'round_robin') {
      showNotification('error', 'Bracket generation is disabled for Round Robin leagues.')
      return
    }

    const size = [2, 4, 8, 16, 32].includes(Number(bracketSize)) ? Number(bracketSize) : 2

    if (teamCount < size) {
      showNotification('error', `Not enough teams for a ${size}-team bracket. This league currently has ${teamCount} team${teamCount === 1 ? '' : 's'}.`)
      return
    }

    setConfirmState({
      title: 'Generate bracket',
      message: `Generate a ${size}-team playoff bracket for this league? Existing bracket games may remain.`,
      confirmText: 'Generate',
      tone: 'warning',
      icon: 'ti-layout-grid2',
      onConfirm: async () => {
        try {
          await axios.post('/api/bracket/generate', { league_id: leagueId, size })
          setConfirmState(null)
          showNotification('success', `${size}-team playoff bracket generated successfully.`)
          await load()
        } catch (err) {
          console.error(err)
          setConfirmState(null)
          showNotification('error', err?.response?.data?.message || 'Failed to generate bracket.')
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const handlePurge = async () => {
    setConfirmState({
      title: 'Purge bracket',
      message: 'Purge all bracket games for this league? This will delete bracket games.',
      confirmText: 'Purge',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/bracket/${leagueId}/purge`)
          setConfirmState(null)
          showNotification('success', 'Bracket purged successfully.')
          await load()
        } catch (err) {
          console.error(err)
          setConfirmState(null)
          showNotification('error', err?.response?.data?.message || 'Failed to purge bracket.')
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const handleAdvance = async (gameId) => {
    setConfirmState({
      title: 'Advance winner',
      message: 'Advance winner for this game? (admin only)',
      confirmText: 'Advance',
      tone: 'warning',
      icon: 'ti-arrow-up',
      onConfirm: async () => {
        try {
          await axios.put(`/api/bracket/${gameId}/advance`)
          setConfirmState(null)
          showNotification('success', 'Winner advanced successfully.')
          await load()
        } catch (err) {
          console.error(err)
          setConfirmState(null)
          showNotification('error', err?.response?.data?.message || 'Failed to advance winner.')
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const { map, keys } = groupedByRound()

  return (
    <div className="feed-area">
      {notification && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 76,
            right: 20,
            zIndex: 1200,
            width: 360,
            maxWidth: 'calc(100vw - 40px)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 12,
            border: notification.type === 'success' ? '1px solid #4ade80' : '1px solid #fb7185',
            background: notification.type === 'success' ? '#166534' : '#9f1239',
            color: '#ffffff',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
            fontWeight: 700,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{notification.type === 'success' ? '✓' : '!'}</span>
          <span style={{ flex: 1, lineHeight: 1.45 }}>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            aria-label="Close notification"
            style={{ background: 'transparent', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Playoff <span style={{ color: 'var(--orange)' }}>Bracket</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'var(--bg-panel)', border: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer', minWidth: 180
            }}
          >
            {leagueOptions.length === 0 && <option value="">Loading leagues...</option>}
            {leagueOptions.map((item) => (
              <option key={item.league_id} value={String(item.league_id)}>
                {item.name} ({item.status})
              </option>
            ))}
          </select>

          {isAdmin && (
            <>
              <select
                value={bracketSize}
                onChange={(e) => setBracketSize(Number(e.target.value))}
                style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  color: 'var(--text)', cursor: 'pointer'
                }}
              >
                <option value={2}>2 teams</option>
                <option value={4}>4 teams</option>
                <option value={8}>8 teams</option>
                <option value={16}>16 teams</option>
                <option value={32}>32 teams</option>
              </select>
              <button
                onClick={handleGenerate}
                disabled={league?.format === 'round_robin'}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: league?.format === 'round_robin' ? '#6b7280' : '#f97316',
                  border: league?.format === 'round_robin' ? '1px solid #9ca3af' : '1px solid #fb923c',
                  color: '#ffffff',
                  cursor: league?.format === 'round_robin' ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: 1,
                  boxShadow: league?.format === 'round_robin' ? 'none' : '0 8px 20px rgba(249, 115, 22, 0.28)',
                }}
              >
                Generate Bracket
              </button>
              <button onClick={handlePurge} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-panel)', border: '1px solid var(--border-md)', cursor: 'pointer', color: '#ffffff', fontWeight: 700 }}>Purge Bracket</button>
            </>
          )}
          <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-panel)', border: '1px solid var(--border-md)', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
        </div>
        {league?.format === 'round_robin' && (
          <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
            This league is configured for <strong>Round Robin</strong>. Bracket generation is disabled for round robin tournaments.
          </div>
        )}
      </div>

      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}
        {!loading && games.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No bracket data. Admins can generate one.</div>}

        {!loading && games.length > 0 && (
          <div style={{ padding: 8 }}>
            <BracketSVG games={games} />
            <div style={{ marginTop: 12 }}>
              {/* fallback list for manual actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {games.map(g => (
                  <div key={g.game_id} style={{ padding: 8, borderRadius: 8, background: 'var(--bg-panel)', border: '1px solid var(--border)', minWidth: 220 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{g.home_team_name || 'TBD'} {g.home_score ?? 0} — {g.away_score ?? 0} {g.away_team_name || 'TBD'}</div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>R{g.bracket_round} S{g.bracket_slot}</div>
                        {g.bracket_stage && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.bracket_stage.replace('_', ' ')}</div>
                        )}
                      </div>
                      {isAdmin && <button onClick={() => handleAdvance(g.game_id)} style={{ padding: '6px 8px' }}>Advance</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
