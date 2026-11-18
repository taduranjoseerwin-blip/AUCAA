import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'

function toStatNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

// ── Quick Stat Button ────────────────────────────────────────
function QuickButton({ label, onClick, variant = 'default', compact = false, disabled = false }) {
  const baseStyle = {
    padding: compact ? '6px 8px' : '8px 12px',
    fontSize: compact ? '10px' : '12px',
    fontWeight: 700,
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    minWidth: compact ? 'auto' : 45,
  }

  const variants = {
    default: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', hover: 'rgba(59,130,246,0.3)' },
    success: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', hover: 'rgba(34,197,94,0.3)' },
    warning: { bg: 'rgba(249,115,22,0.15)', color: '#f97316', hover: 'rgba(249,115,22,0.3)' },
    danger: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', hover: 'rgba(239,68,68,0.3)' },
  }

  const style = variants[variant] || variants.default

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseStyle,
        background: style.bg,
        color: style.color,
      }}
      onMouseEnter={(e) => { if (!disabled) e.target.style.background = style.hover }}
      onMouseLeave={(e) => { e.target.style.background = style.bg }}
    >
      {label}
    </button>
  )
}

// ── Player Stat Cell ─────────────────────────────────────────
function PlayerStatCell({ player, gameId, onUpdate }) {
  const [stats, setStats] = useState({
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    fouls: 0,
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (player.stats) {
      setStats({
        points: player.stats.points || 0,
        rebounds: player.stats.rebounds || 0,
        assists: player.stats.assists || 0,
        steals: player.stats.steals || 0,
        blocks: player.stats.blocks || 0,
        fouls: player.stats.fouls || 0,
      })
    }
  }, [player])

  const updateStat = async (statName, value) => {
    setIsLoading(true)
    const newStats = { ...stats, [statName]: value }
    setStats(newStats)

    try {
      await axios.post('/api/admin/player-stats', {
        game_id: gameId,
        player_id: player.player_id,
        [statName]: value,
      })
      onUpdate?.(player.player_id, statName, value)
    } catch (err) {
      console.error('Failed to update stat:', err)
      setIsLoading(false)
    }
  }

  const increment = (stat) => updateStat(stat, Math.max(0, stats[stat] + 1))
  const decrement = (stat) => updateStat(stat, Math.max(0, stats[stat] - 1))
  const addPoints = (amount) => updateStat('points', Math.max(0, stats.points + amount))

  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--orange)'
        e.currentTarget.style.background = 'rgba(249,115,22,0.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--bg-panel)'
      }}
    >
      {/* Player Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
            #{player.jersey_number} {player.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {player.position}
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
          ID: {player.player_id}
        </div>
      </div>

      {/* Points Section - Prominent */}
      <div style={{ background: 'rgba(249,115,22,0.1)', padding: '10px', borderRadius: 6, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--orange)' }}>POINTS</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--orange)' }}>
            {stats.points}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <QuickButton label="−1" onClick={() => decrement('points')} variant="danger" compact />
          <QuickButton label="+1" onClick={() => addPoints(1)} variant="default" compact />
          <QuickButton label="+2" onClick={() => addPoints(2)} variant="default" compact />
          <QuickButton label="+3" onClick={() => addPoints(3)} variant="default" compact />
        </div>
      </div>

      {/* Other Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {/* REB */}
        <div style={{ background: 'rgba(34,197,94,0.08)', padding: '8px', borderRadius: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>REB</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{stats.rebounds}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <QuickButton label="−" onClick={() => decrement('rebounds')} variant="danger" compact />
            <QuickButton label="+" onClick={() => increment('rebounds')} variant="success" compact />
          </div>
        </div>

        {/* AST */}
        <div style={{ background: 'rgba(34,197,94,0.08)', padding: '8px', borderRadius: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>AST</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{stats.assists}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <QuickButton label="−" onClick={() => decrement('assists')} variant="danger" compact />
            <QuickButton label="+" onClick={() => increment('assists')} variant="success" compact />
          </div>
        </div>

        {/* STL */}
        <div style={{ background: 'rgba(59,130,246,0.08)', padding: '8px', borderRadius: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>STL</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{stats.steals}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <QuickButton label="−" onClick={() => decrement('steals')} variant="danger" compact />
            <QuickButton label="+" onClick={() => increment('steals')} variant="default" compact />
          </div>
        </div>

        {/* BLK */}
        <div style={{ background: 'rgba(59,130,246,0.08)', padding: '8px', borderRadius: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>BLK</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{stats.blocks}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <QuickButton label="−" onClick={() => decrement('blocks')} variant="danger" compact />
            <QuickButton label="+" onClick={() => increment('blocks')} variant="default" compact />
          </div>
        </div>

        {/* FOUL */}
        <div style={{ background: 'rgba(249,115,22,0.08)', padding: '8px', borderRadius: 6, gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>FOULS</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f97316' }}>{stats.fouls}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <QuickButton label="−" onClick={() => decrement('fouls')} variant="danger" compact />
            <QuickButton label="+" onClick={() => increment('fouls')} variant="warning" compact />
          </div>
        </div>
      </div>
    </div>
  )
}

function PlayerStatTableRow({ player, gameId, onUpdate, teamColor }) {
  const [stats, setStats] = useState({
    points: toStatNumber(player.stats?.points),
    rebounds: toStatNumber(player.stats?.rebounds),
    assists: toStatNumber(player.stats?.assists),
    steals: toStatNumber(player.stats?.steals),
    blocks: toStatNumber(player.stats?.blocks),
    fouls: toStatNumber(player.stats?.fouls),
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!player.stats) return
    setStats((current) => ({
      points: toStatNumber(player.stats.points ?? current.points),
      rebounds: toStatNumber(player.stats.rebounds ?? current.rebounds),
      assists: toStatNumber(player.stats.assists ?? current.assists),
      steals: toStatNumber(player.stats.steals ?? current.steals),
      blocks: toStatNumber(player.stats.blocks ?? current.blocks),
      fouls: toStatNumber(player.stats.fouls ?? current.fouls),
    }))
  }, [player.stats])

  const updateStat = async (statName, value) => {
    const numericValue = Math.max(0, toStatNumber(value))
    const previousValue = stats[statName]
    setIsLoading(true)
    setStats((current) => ({ ...current, [statName]: numericValue }))
    try {
      await axios.post('/api/admin/player-stats', { game_id: gameId, player_id: player.player_id, [statName]: numericValue })
      onUpdate?.(player.player_id, statName, numericValue)
    } catch (err) {
      console.error('Failed to update stat:', err)
      setStats((current) => ({ ...current, [statName]: previousValue }))
    } finally {
      setIsLoading(false)
    }
  }

  const control = (statName, variant = 'success') => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <QuickButton label="−" onClick={() => updateStat(statName, Math.max(0, toStatNumber(stats[statName]) - 1))} variant="danger" compact disabled={isLoading} />
      <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 800, color: 'var(--text)' }}>{stats[statName]}</span>
      <QuickButton label="+" onClick={() => updateStat(statName, toStatNumber(stats[statName]) + 1)} variant={variant} compact disabled={isLoading} />
    </div>
  )

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', opacity: isLoading ? 0.65 : 1 }}>
      <td style={{ padding: '9px 12px', borderLeft: `4px solid ${teamColor}`, minWidth: 200 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>#{player.jersey_number || '?'} {player.name}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{player.position || 'N/A'} · ID {player.player_id}</div>
      </td>
      <td style={{ padding: 8, minWidth: 190 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <QuickButton label="−" onClick={() => updateStat('points', Math.max(0, toStatNumber(stats.points) - 1))} variant="danger" compact disabled={isLoading} />
          <QuickButton label="+1" onClick={() => updateStat('points', toStatNumber(stats.points) + 1)} compact disabled={isLoading} />
          <QuickButton label="+2" onClick={() => updateStat('points', toStatNumber(stats.points) + 2)} compact disabled={isLoading} />
          <QuickButton label="+3" onClick={() => updateStat('points', toStatNumber(stats.points) + 3)} compact disabled={isLoading} />
          <span style={{ minWidth: 26, textAlign: 'center', fontWeight: 800, color: '#f97316' }}>{stats.points}</span>
        </div>
      </td>
      <td style={{ textAlign: 'center' }}>{control('rebounds')}</td>
      <td style={{ textAlign: 'center' }}>{control('assists')}</td>
      <td style={{ textAlign: 'center' }}>{control('steals', 'default')}</td>
      <td style={{ textAlign: 'center' }}>{control('blocks', 'default')}</td>
      <td style={{ textAlign: 'center' }}>{control('fouls', 'warning')}</td>
    </tr>
  )
}

// ── Main Component ────────────────────────────────────────────
export default function LiveScoreboard() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const [games, setGames] = useState([])
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [homePlayers, setHomePlayers] = useState([])
  const [awayPlayers, setAwayPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchHome, setSearchHome] = useState('')
  const [searchAway, setSearchAway] = useState('')

  // Load live games
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

  // Load players for game
  const loadPlayersForGame = useCallback(async (gameId) => {
    try {
      const res = await axios.get('/api/games')
      const game = res.data.find((g) => g.game_id === gameId)
      if (!game) return

      setSelectedGame(game)

      const playersRes = await axios.get('/api/players?all=true')
      const allPlayers = playersRes.data

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

      const home = allPlayers
        .filter((p) => Number(p.team_id) === Number(game.home_team_id))
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
        .filter((p) => Number(p.team_id) === Number(game.away_team_id))
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
      console.error('Failed to load players:', err)
    }
  }, [])

  // Socket listeners
  useEffect(() => {
    if (!socket) return

    const handleScoreUpdate = (data) => {
      if (Number(data.gameId) !== Number(selectedGameId)) return
      setSelectedGame((current) => current ? {
        ...current,
        home_score: data.homeScore,
        away_score: data.awayScore,
      } : current)
    }

    const handleStatusChanged = async (data) => {
      if (!data) return
      const currentGameId = Number(selectedGameId)
      const nextGameId = Number(data.gameId)

      if (currentGameId && currentGameId === nextGameId && data.status === 'completed') {
        setSelectedGameId(null)
        setSelectedGame(null)
        setHomePlayers([])
        setAwayPlayers([])
        await loadGames()
        return
      }

      if (!currentGameId && nextGameId) {
        await loadGames()
      }
    }

    const handlePlayerStatsUpdated = (data) => {
      if (Number(data.game_id) !== Number(selectedGameId)) return

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

    socket.on('scoreUpdate', handleScoreUpdate)
    socket.on('statusUpdate', handleStatusChanged)
    socket.on('scheduleUpdated', handleStatusChanged)
    socket.on('playerStatsUpdated', handlePlayerStatsUpdated)
    return () => {
      socket.off('scoreUpdate', handleScoreUpdate)
      socket.off('statusUpdate', handleStatusChanged)
      socket.off('scheduleUpdated', handleStatusChanged)
      socket.off('playerStatsUpdated', handlePlayerStatsUpdated)
    }
  }, [socket, selectedGameId, loadGames])

  useEffect(() => {
    loadGames()
  }, [loadGames])

  const filteredHome = homePlayers.filter((p) =>
    p.name.toLowerCase().includes(searchHome.toLowerCase())
  )
  const filteredAway = awayPlayers.filter((p) =>
    p.name.toLowerCase().includes(searchAway.toLowerCase())
  )
  const updatePlayerStats = (playerId, statName, value) => {
    const updatePlayer = (players) => players.map((player) =>
      Number(player.player_id) === Number(playerId)
        ? { ...player, stats: { ...player.stats, [statName]: value } }
        : player
    )
    setHomePlayers(updatePlayer)
    setAwayPlayers(updatePlayer)
  }
  const homeScore = homePlayers.reduce((total, player) => total + toStatNumber(player.stats?.points), 0)
  const awayScore = awayPlayers.reduce((total, player) => total + toStatNumber(player.stats?.points), 0)

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading live games...
      </div>
    )
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', padding: '24px clamp(20px, 4vw, 64px)', maxWidth: 1800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, color: 'var(--text)' }}>
        <i className="ti ti-live" style={{ marginRight: 8, color: '#ef4444', fontSize: 28 }} />
        Live Scoreboard Input
      </h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
        Quick input for game stats — update player statistics in real-time
      </p>

      {!selectedGameId ? (
        // Game Selection Screen
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Select a Live Game
          </h2>
          {games.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No live games at the moment</div>
              <div style={{ fontSize: 12 }}>Start a game from Games Management to begin live scoring</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {games.map((game) => (
                <button
                  key={game.game_id}
                  onClick={() => {
                    setSelectedGameId(game.game_id)
                    loadPlayersForGame(game.game_id)
                  }}
                  style={{
                    padding: 16,
                    background: 'var(--bg-panel)',
                    border: '2px solid rgba(239,68,68,0.3)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ef4444'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {game.home_team_name} vs {game.away_team_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {game.league_name}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    Status: <strong style={{ color: '#ef4444' }}>LIVE</strong>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12 }}>
            <button
              onClick={() => {
                setSelectedGameId(null)
                setSelectedGame(null)
                setHomePlayers([])
                setAwayPlayers([])
                setSearchHome('')
                setSearchAway('')
              }}
              style={{ padding: '9px 16px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              Change Game
            </button>

            <button
              onClick={async () => {
                try {
                  await axios.patch(`/api/admin/games/${selectedGameId}/status`, { status: 'completed' })
                  await loadGames()
                  setSelectedGameId(null)
                  setSelectedGame(null)
                  setHomePlayers([])
                  setAwayPlayers([])
                  setSearchHome('')
                  setSearchAway('')
                } catch (err) {
                  console.error('Failed to end game:', err)
                }
              }}
              style={{ padding: '9px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >
              End Game
            </button>
          </div>
          {/* Game Header with Score and Quarter */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            {/* Top Row: Teams and Scores */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  {selectedGame?.home_team_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedGame?.league_name} • {selectedGame?.division} Division
                </div>
              </div>

              {/* Score Display - Center */}
              <div style={{ textAlign: 'center', margin: '0 32px' }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>
                  <span style={{ color: 'rgba(59,130,246,0.8)' }}>{homeScore}</span>
                  <span style={{ fontSize: 24, color: 'var(--text-muted)', margin: '0 8px' }}>−</span>
                  <span style={{ color: 'rgba(249,115,22,0.8)' }}>{awayScore}</span>
                </div>
              </div>

              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  {selectedGame?.away_team_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Away Team
                </div>
              </div>
            </div>

            {/* Quarter Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Quarter Controls */}
              <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>
                  Current Quarter
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['1', '2', '3', '4', 'Finals'].map((quarter) => {
                    const isCurrentQuarter = String(selectedGame?.current_quarter ?? '') === quarter
                    return (
                    <button
                      key={quarter}
                      onClick={async () => {
                        try {
                          await axios.put(`/api/games/${selectedGameId}/score`, {
                            home_score: selectedGame?.home_score || 0,
                            away_score: selectedGame?.away_score || 0,
                            current_quarter: quarter,
                            status: selectedGame?.status,
                          })
                          setSelectedGame({ ...selectedGame, current_quarter: quarter })
                        } catch (err) {
                          console.error('Failed to update quarter:', err)
                        }
                      }}
                        style={{
                          padding: '6px 12px',
                          background: isCurrentQuarter ? 'rgba(249,115,22,0.3)' : 'var(--bg-panel)',
                          color: isCurrentQuarter ? '#f97316' : 'var(--text)',
                          border: isCurrentQuarter ? '2px solid #f97316' : '1px solid var(--border)',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrentQuarter) {
                            e.target.style.borderColor = '#f97316'
                            e.target.style.background = 'rgba(249,115,22,0.1)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrentQuarter) {
                            e.target.style.borderColor = 'var(--border)'
                            e.target.style.background = 'var(--bg-panel)'
                          }
                        }}
                      >
                        Q{quarter}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Change Game Button */}
              <button
                style={{ display: 'none' }}
                onClick={() => {
                  setSelectedGameId(null)
                  setSelectedGame(null)
                  setHomePlayers([])
                  setAwayPlayers([])
                  setSearchHome('')
                  setSearchAway('')
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
                }}
              >
                ← Change Game
              </button>
            </div>
          </div>

          {/* Wide table layout */}
          <div style={{ display: 'grid', gap: 20 }}>
            {/* HOME TEAM */}
            <div>
              <div style={{ background: 'rgba(96,165,250,0.15)', border: '2px solid rgba(96,165,250,0.4)', borderRadius: 10, overflow: 'auto', marginBottom: 12 }}>
                <div style={{ padding: '12px 16px', background: 'rgba(96,165,250,0.1)', borderBottom: '1px solid rgba(96,165,250,0.3)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>
                    {selectedGame?.home_team_name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {homePlayers.length} players
                  </div>
                </div>
                <div style={{ minWidth: 980, padding: 12 }}>
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchHome}
                    onChange={(e) => setSearchHome(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: 'var(--text)',
                      marginBottom: 12,
                      fontFamily: 'inherit',
                    }}
                  />
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead><tr style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                      <th style={{ width: 220, padding: '8px 12px', textAlign: 'left' }}>Player</th>
                      <th style={{ width: 210 }}>Points</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>Foul</th>
                    </tr></thead>
                    <tbody>
                    {filteredHome.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No players found</td></tr>
                    ) : (
                      filteredHome.map((player) => (
                        <PlayerStatTableRow
                          key={player.player_id}
                          player={player}
                          gameId={selectedGameId}
                          onUpdate={updatePlayerStats}
                          teamColor="#60a5fa"
                        />
                      ))
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* AWAY TEAM */}
            <div>
              <div style={{ background: 'rgba(249,115,22,0.15)', border: '2px solid rgba(249,115,22,0.4)', borderRadius: 10, overflow: 'auto', marginBottom: 12 }}>
                <div style={{ padding: '12px 16px', background: 'rgba(249,115,22,0.1)', borderBottom: '1px solid rgba(249,115,22,0.3)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>
                    {selectedGame?.away_team_name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {awayPlayers.length} players
                  </div>
                </div>
                <div style={{ minWidth: 980, padding: 12 }}>
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchAway}
                    onChange={(e) => setSearchAway(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: 'var(--text)',
                      marginBottom: 12,
                      fontFamily: 'inherit',
                    }}
                  />
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead><tr style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                      <th style={{ width: 220, padding: '8px 12px', textAlign: 'left' }}>Player</th>
                      <th style={{ width: 210 }}>Points</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>Foul</th>
                    </tr></thead>
                    <tbody>
                    {filteredAway.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No players found</td></tr>
                    ) : (
                      filteredAway.map((player) => (
                        <PlayerStatTableRow
                          key={player.player_id}
                          player={player}
                          gameId={selectedGameId}
                          onUpdate={updatePlayerStats}
                          teamColor="#f97316"
                        />
                      ))
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
