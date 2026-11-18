import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'

// ── Stat Button Component ────────────────────────────────
function StatButton({ label, onClick, variant = 'default', size = 'small' }) {
  const baseStyle = {
    padding: variant === 'large' ? '10px 14px' : '6px 10px',
    fontSize: variant === 'large' ? '13px' : '11px',
    fontWeight: 700,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: variant === 'large' ? 50 : 40,
  }

  const variants = {
    default: {
      bg: 'rgba(59,130,246,0.15)',
      color: '#60a5fa',
      hover: 'rgba(59,130,246,0.25)',
    },
    success: {
      bg: 'rgba(34,197,94,0.15)',
      color: '#22c55e',
      hover: 'rgba(34,197,94,0.25)',
    },
    warning: {
      bg: 'rgba(249,115,22,0.15)',
      color: '#f97316',
      hover: 'rgba(249,115,22,0.25)',
    },
    danger: {
      bg: 'rgba(239,68,68,0.15)',
      color: '#ef4444',
      hover: 'rgba(239,68,68,0.25)',
    },
  }

  const style = variants[variant] || variants.default

  return (
    <button
      onClick={onClick}
      style={{
        ...baseStyle,
        background: style.bg,
        color: style.color,
      }}
      onMouseEnter={(e) => (e.target.style.background = style.hover)}
      onMouseLeave={(e) => (e.target.style.background = style.bg)}
      title={label}
    >
      {label}
    </button>
  )
}

// ── Player Table Row ──
function PlayerRow({ player, teamType, gameId, onStatsUpdate }) {
  const [localStats, setLocalStats] = useState({
    points: player.stats?.points || 0,
    rebounds: player.stats?.rebounds || 0,
    assists: player.stats?.assists || 0,
    steals: player.stats?.steals || 0,
    blocks: player.stats?.blocks || 0,
    fouls: player.stats?.fouls || 0,
  })
  const [loading, setLoading] = useState(false)

  const updateStat = async (statName, value) => {
    setLoading(true)
    const newStats = { ...localStats, [statName]: value }
    setLocalStats(newStats)

    try {
      await axios.post('/api/admin/player-stats', {
        game_id: gameId,
        player_id: player.player_id,
        [statName]: value,
      })
      onStatsUpdate(player.player_id, statName, value)
    } catch (err) {
      console.error('Failed to update stat:', err)
      setLoading(false)
    }
  }

  const increment = (statName) => {
    const newValue = (localStats[statName] || 0) + 1
    updateStat(statName, newValue)
  }

  const decrement = (statName) => {
    const newValue = Math.max(0, (localStats[statName] || 0) - 1)
    updateStat(statName, newValue)
  }

  const quickAdd = (statName, amount) => {
    const newValue = (localStats[statName] || 0) + amount
    updateStat(statName, newValue)
  }

  const controlStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }
  const valueStyle = { minWidth: 28, textAlign: 'center', fontWeight: 800, color: 'var(--text)' }
  const statControl = (label, statName, variant = 'success') => (
    <div style={controlStyle}>
      <StatButton label="−" onClick={() => decrement(statName)} variant="danger" />
      <span style={valueStyle}>{localStats[statName]}</span>
      <StatButton label="+" onClick={() => increment(statName)} variant={variant} />
    </div>
  )

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', opacity: loading ? 0.65 : 1 }}>
      <td style={{ padding: '9px 12px', borderLeft: `4px solid ${teamType === 'home' ? '#60a5fa' : '#f97316'}`, minWidth: 190 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
          #{player.jersey_number || '?'} {player.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {player.position || 'N/A'}
        </div>
      </td>
      <td style={{ padding: '9px 8px', minWidth: 150 }}>
        <div style={controlStyle}>
        <StatButton label="−" onClick={() => decrement('points')} variant="danger" size="small" />
        <StatButton label="+1" onClick={() => quickAdd('points', 1)} variant="default" size="large" />
        <StatButton label="+2" onClick={() => quickAdd('points', 2)} variant="default" size="large" />
        <StatButton label="+3" onClick={() => quickAdd('points', 3)} variant="default" size="large" />
        <span style={{ ...valueStyle, color: '#f97316' }}>{localStats.points}</span>
        </div>
      </td>
      <td style={{ padding: '9px 8px' }}>{statControl('REB', 'rebounds')}</td>
      <td style={{ padding: '9px 8px' }}>{statControl('AST', 'assists')}</td>
      <td style={{ padding: '9px 8px' }}>{statControl('STL', 'steals')}</td>
      <td style={{ padding: '9px 8px' }}>{statControl('BLK', 'blocks')}</td>
      <td style={{ padding: '9px 8px' }}>{statControl('FOUL', 'fouls', 'warning')}</td>
    </tr>
  )
}

// ── Main Component ────────────────────────────────────────
export default function LiveStatsUpdate() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const [games, setGames] = useState([])
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [homePlayers, setHomePlayers] = useState([])
  const [awayPlayers, setAwayPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // Fetch live/ongoing games
  const loadGames = useCallback(async () => {
    try {
      const res = await axios.get('/api/games')
      const liveGames = res.data.filter((g) => ['live', 'halftime'].includes(g.status))
      setGames(liveGames)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load games:', err)
      setLoading(false)
    }
  }, [])

  // Fetch players for selected game
  const loadPlayersForGame = useCallback(async (gameId) => {
    try {
      const res = await axios.get('/api/games')
      const game = res.data.find((g) => g.game_id === gameId)
      if (!game) {
        console.error('[LiveStats] Game not found:', gameId)
        return
      }

      setSelectedGame(game)

      // Get all players (including unverified to show all team roster)
      const playersRes = await axios.get('/api/players?all=true')
      const allPlayers = playersRes.data

      // Get stats for this game
      const statsRes = await axios.get(`/api/games/${gameId}/stats`)
      const statsMap = {}
      statsRes.data.forEach((stat) => {
        statsMap[stat.player_id] = {
          points: stat.points,
          rebounds: stat.rebounds,
          assists: stat.assists,
          steals: stat.steals,
          blocks: stat.blocks,
          fouls: stat.fouls,
        }
      })

      // Filter and organize players
      const home = allPlayers
        .filter((p) => p.team_id === game.home_team_id)
        .map((p) => ({
          ...p,
          stats: statsMap[p.player_id] || {
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            fouls: 0,
          },
        }))

      const away = allPlayers
        .filter((p) => p.team_id === game.away_team_id)
        .map((p) => ({
          ...p,
          stats: statsMap[p.player_id] || {
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            fouls: 0,
          },
        }))

      setHomePlayers(home)
      setAwayPlayers(away)
    } catch (err) {
      console.error('[LiveStats] Failed to load players:', err)
    }
  }, [])

  // Socket listeners
  useEffect(() => {
    if (!socket) return

    const handlePlayerStatsUpdated = (data) => {
      if (data.game_id !== selectedGameId) return

      // Update local state
      setHomePlayers((prev) =>
        prev.map((p) =>
          p.player_id === data.player_id
            ? { ...p, stats: { ...p.stats, ...data.stats } }
            : p
        )
      )
      setAwayPlayers((prev) =>
        prev.map((p) =>
          p.player_id === data.player_id
            ? { ...p, stats: { ...p.stats, ...data.stats } }
            : p
        )
      )
    }

    const handleStatusChanged = async (data) => {
      if (!data) return

      if (Number(data.gameId) === Number(selectedGameId) && data.status === 'completed') {
        setSelectedGameId(null)
        setSelectedGame(null)
        setHomePlayers([])
        setAwayPlayers([])
        await loadGames()
        return
      }

      if (Number(data.gameId) === Number(selectedGameId)) {
        await loadGames()
        await loadPlayersForGame(Number(selectedGameId))
        return
      }

      await loadGames()
    }

    socket.on('playerStatsUpdated', handlePlayerStatsUpdated)
    socket.on('statusUpdate', handleStatusChanged)
    socket.on('scheduleUpdated', handleStatusChanged)
    return () => {
      socket.off('playerStatsUpdated', handlePlayerStatsUpdated)
      socket.off('statusUpdate', handleStatusChanged)
      socket.off('scheduleUpdated', handleStatusChanged)
    }
  }, [socket, selectedGameId, loadGames, loadPlayersForGame])

  // Initial load
  useEffect(() => {
    loadGames()
  }, [loadGames])

  // Handle game selection
  const handleGameSelect = async (gameId) => {
    setSelectedGameId(gameId)
    await loadPlayersForGame(gameId)
  }

  const handleStatsUpdate = (playerId, statName, value) => {
    setMessage(`${statName} updated!`)
    setTimeout(() => setMessage(''), 2000)
  }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading live games...
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20, color: 'var(--text)' }}>
        <i className="ti ti-live" style={{ marginRight: 8, color: 'var(--orange)' }} />
        Live Stats Update
      </h1>

      {/* Game Selector */}
      {!selectedGameId ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Select a Live Game</h2>
          {games.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No live games at the moment.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {games.map((game) => (
                <button
                  key={game.game_id}
                  onClick={() => handleGameSelect(game.game_id)}
                  style={{
                    padding: 16,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--orange)'
                    e.currentTarget.style.background = 'rgba(249,115,22,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--bg-panel)'
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                    {game.home_team_name} vs {game.away_team_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Status: <strong style={{ color: game.status === 'live' ? '#22c55e' : '#f97316' }}>
                      {game.status.toUpperCase()}
                    </strong>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Game Header with Back Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                {selectedGame?.home_team_name} vs {selectedGame?.away_team_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Status: <strong style={{ color: selectedGame?.status === 'live' ? '#22c55e' : '#f97316' }}>
                  {selectedGame?.status.toUpperCase()}
                </strong>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedGameId(null)
                setSelectedGame(null)
                setHomePlayers([])
                setAwayPlayers([])
              }}
              style={{
                padding: '10px 16px',
                background: 'rgba(239,68,68,0.15)',
                color: '#ef4444',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.25)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
              }}
            >
              ← Back to Games
            </button>
          </div>

          {message && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(34,197,94,0.15)',
                color: '#22c55e',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}

          {/* Wide scoring tables: one row per player */}
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Home Team */}
            <div style={{ background: 'var(--bg-card)', border: '2px solid rgba(96,165,250,0.3)', borderRadius: 10, overflow: 'auto' }}>
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(96,165,250,0.1)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#60a5fa',
                }}
              >
                {selectedGame?.home_team_name}
              </div>
              <div style={{ minWidth: 900, padding: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead><tr style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                    <th style={{ width: 220, padding: '8px 12px', textAlign: 'left' }}>Player</th>
                    <th style={{ width: 190 }}>Points</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>Foul</th>
                  </tr></thead>
                  <tbody>
                {homePlayers.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 20, color: 'var(--text-muted)', textAlign: 'center' }}>No players assigned</td></tr>
                ) : (
                  homePlayers.map((player) => (
                    <PlayerRow
                      key={player.player_id}
                      player={player}
                      teamType="home"
                      gameId={selectedGameId}
                      onStatsUpdate={handleStatsUpdate}
                    />
                  ))
                )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Away Team */}
            <div style={{ background: 'var(--bg-card)', border: '2px solid rgba(249,115,22,0.3)', borderRadius: 10, overflow: 'auto' }}>
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(249,115,22,0.1)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#f97316',
                }}
              >
                {selectedGame?.away_team_name}
              </div>
              <div style={{ minWidth: 900, padding: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead><tr style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                    <th style={{ width: 220, padding: '8px 12px', textAlign: 'left' }}>Player</th>
                    <th style={{ width: 190 }}>Points</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>Foul</th>
                  </tr></thead>
                  <tbody>
                {awayPlayers.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 20, color: 'var(--text-muted)', textAlign: 'center' }}>No players assigned</td></tr>
                ) : (
                  awayPlayers.map((player) => (
                    <PlayerRow
                      key={player.player_id}
                      player={player}
                      teamType="away"
                      gameId={selectedGameId}
                      onStatsUpdate={handleStatsUpdate}
                    />
                  ))
                )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
