import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useGameSocket } from '../hooks/useSocket'
import { useSocket } from '../hooks/useSocket'

// Right panel: top scorers
function TopScorers({ leagueId }) {
  const [leaders, setLeaders] = useState([])

  useEffect(() => {
    if (!leagueId) return
    axios.get(`/api/players/leaders/${leagueId}?category=points`)
      .then(r => setLeaders(r.data.slice(0, 5)))
      .catch(() => {})
  }, [leagueId])

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
        Top Scorers
      </div>
      {leaders.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
          No stats yet
        </div>
      )}
      {leaders.map((p, i) => (
        <div key={p.player_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--orange-glow)', border: '1px solid var(--orange-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: 'var(--orange)', flexShrink: 0
          }}>
            {p.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.team_name}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>{p.ppg}</div>
        </div>
      ))}
    </div>
  )
}

// Live game hero card
function HeroGameCard({ game, onScoreUpdate }) {
  const [scores, setScores] = useState({ home: game.home_score, away: game.away_score })

  useGameSocket(game.game_id, (data) => {
    setScores({ home: data.homeScore, away: data.awayScore })
    onScoreUpdate && onScoreUpdate(data)
  })

  const navigate = useNavigate()
  const handleCardClick = () => {
    if (game.live_link) {
      window.open(game.live_link, '_blank', 'noopener,noreferrer')
    } else {
      navigate(`/game/${game.game_id}`)
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={handleCardClick}>
      {/* Screen area */}
      <div style={{
        background: '#0a0c12',
        height: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
              {game.home_team_name}
            </div>
            <div style={{ fontSize: 52, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {scores.home}
            </div>
          </div>
          <div style={{ fontSize: 20, color: 'var(--text-hint)', fontWeight: 300 }}>VS</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
              {game.away_team_name}
            </div>
            <div style={{ fontSize: 52, fontWeight: 700, color: scores.away > scores.home ? 'var(--orange)' : 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {scores.away}
            </div>
          </div>
        </div>
        {game.live_link ? (
          <a
            href={game.live_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 10, right: 12,
              fontSize: 13, fontWeight: 600, color: '#fff',
              background: '#ef4444', padding: '8px 12px', borderRadius: 6,
              textDecoration: 'none'
            }}
          >
            Watch Live
          </a>
        ) : (
          <div style={{
            position: 'absolute', bottom: 10, right: 12,
            fontSize: 13, fontWeight: 600, color: 'var(--orange)',
            background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 4
          }}>
            Q{game.current_quarter} · LIVE
          </div>
        )}
      </div>
      {/* Meta */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-live"><span className="live-pulse" />LIVE GAME</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {game.home_team_name} vs {game.away_team_name} — Live · Q{game.current_quarter}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {game.league_name} · {game.division} Division · {game.venue || 'Legazpi City Sports Complex'}
        </div>
      </div>
    </div>
  )
}

// Small game card
function GameCard({ game }) {
  const navigate = useNavigate()

  return (
    <div className="card-inner" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => navigate(`/game/${game.game_id}`)}>
      <div style={{
        height: 80, background: '#12151f', borderRadius: 6, marginBottom: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', fontSize: 28
      }}>
        <div style={{
          position: 'absolute', bottom: 5, right: 7,
          fontSize: 11, color: '#999', background: 'rgba(0,0,0,0.5)', padding: '1px 5px', borderRadius: 3
        }}>
          {game.status === 'completed'
            ? `${game.home_score} – ${game.away_score}`
            : game.status === 'live' ? `Q${game.current_quarter}` : 'Upcoming'}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
        {game.home_team_name?.split(' ')[0]} vs {game.away_team_name?.split(' ')[0]}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
        {game.division} · {new Date(game.scheduled_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  )
}

// Game progress bar (right panel)
function GameProgress({ game }) {
  const [scores, setScores] = useState({ home: game.home_score, away: game.away_score })
  useGameSocket(game.game_id, (d) => setScores({ home: d.homeScore, away: d.awayScore }))

  const total = scores.home + scores.away || 1
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
        Game Progress
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
          <span>{game.home_team_name?.split(' ')[0]}</span>
          <span style={{ fontWeight: 700, color: 'var(--orange)' }}>{scores.home}</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(scores.home / total) * 100}%`, background: 'var(--orange)', borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
          <span>{game.away_team_name?.split(' ')[0]}</span>
          <span style={{ fontWeight: 700, color: 'var(--green)' }}>{scores.away}</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(scores.away / total) * 100}%`, background: 'var(--green)', borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
      </div>
    </div>
  )
}

// ── Main Highlights Page ─────────────────────────────────────
export default function Highlights() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [highlight, setHighlight] = useState(null)
  const socket = useSocket()

  const loadGames = async () => {
    try {
      const res = await axios.get('/api/games')
      setGames(res.data)
    } catch (err) {
      console.error('Failed to load games', err)
    } finally {
      setLoading(false)
    }
  }

  const loadHighlight = async () => {
    try {
      const res = await axios.get('/api/highlight')
      setHighlight(res.data)
    } catch (err) {
      console.error('Failed to load highlight', err)
    }
  }

  useEffect(() => {
    loadGames()
    loadHighlight()
    const t = setInterval(loadGames, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onHighlight = (data) => setHighlight(data)
    const onLive = () => loadGames()
    socket.on('highlightUpdated', onHighlight)
    socket.on('gameLive', onLive)
    socket.on('scheduleUpdated', onLive)
    socket.on('scoreUpdate', onLive)
    socket.on('statusUpdate', onLive)
    return () => {
      socket.off('highlightUpdated', onHighlight)
      socket.off('gameLive', onLive)
      socket.off('scheduleUpdated', onLive)
      socket.off('scoreUpdate', onLive)
      socket.off('statusUpdate', onLive)
    }
  }, [socket])

  const liveGames = games.filter(g => g.status === 'live')
  const upcomingGames = games.filter(g => g.status === 'upcoming')
  const completedGames = games.filter(g => g.status === 'completed')
  const allOther = [...upcomingGames, ...completedGames]
  const featuredGame = liveGames[0]
  const highlightLink = highlight?.link?.trim()
  const leagueId = featuredGame?.league_id || games[0]?.league_id

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Feed */}
      <div className="feed-area">
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
            Loading games...
          </div>
        )}

        {/* Hero: featured live game */}
        {/* Highlight cover */}
        {highlight?.image && (
          <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={highlight.image} alt={highlight.title || 'Highlight'} style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* Highlight page link box */}
        {highlightLink && (
          <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(90deg,#111827,#0b1220)', border: '1px solid var(--border)' }}>
            <div style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--orange)' }}>
                  {highlight.title || 'Live Stream'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                  Click the button to join the highlight broadcast.
                </div>
              </div>
              <a href={highlightLink} target="_blank" rel="noopener noreferrer" style={{ background: '#ef4444', color: '#fff', padding: '10px 16px', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Watch Now</a>
            </div>
          </div>
        )}

        {/* Live game hero card */}
        {featuredGame && (
          <div style={{ marginBottom: 12 }}>
            <HeroGameCard game={featuredGame} />
          </div>
        )}

        {/* Grid of other games */}
        {allOther.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {allOther.map(g => <GameCard key={g.game_id} game={g} />)}
          </div>
        )}

        {/* Extra live games beyond the first */}
        {liveGames.slice(1).map(g => (
          <div key={g.game_id} style={{ marginTop: 10 }}>
            <HeroGameCard game={g} />
          </div>
        ))}

        {!loading && games.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <i className="ti ti-ball-basketball" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
            No games available yet.
          </div>
        )}
      </div>

      {/* Right rail */}
      <aside className="right-rail">
        {featuredGame && (
          <div style={{ marginBottom: 16 }}>
            <GameProgress game={featuredGame} />
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16 }}>
          <TopScorers leagueId={leagueId} />
        </div>

      </aside>
    </div>
  )
}