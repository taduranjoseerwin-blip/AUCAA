import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'


const statCategories = [
  { key: 'points', label: 'Points', shortLabel: 'PPG', color: 'var(--orange)' },
  { key: 'rebounds', label: 'Rebounds', shortLabel: 'RPG', color: '#38bdf8' },
  { key: 'assists', label: 'Assists', shortLabel: 'APG', color: '#4ade80' },
  { key: 'steals', label: 'Steals', shortLabel: 'SPG', color: '#f472b6' },
  { key: 'blocks', label: 'Blocks', shortLabel: 'BPG', color: '#a78bfa' }
]

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 18,
      flex: 1,
      minWidth: 140,
      minHeight: 96
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 10
      }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function LeaderCard({ rank, player, statLabel, color }) {
  const initials = player.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 14,
      cursor: 'default'
    }}>
      <div style={{
        width: 30,
        fontSize: 13,
        fontWeight: 700,
        color: rank === 1 ? 'var(--orange)' : 'var(--text-muted)'
      }}>
        #{rank}
      </div>

      <div style={{
        width: 42,
        height: 42,
        borderRadius: '50%',
        background: 'var(--orange-glow)',
        border: `1px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color
      }}>
        {initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {player.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {player.team_name}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color }}>
          {player.stat_value ?? player.ppg ?? 0}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{statLabel}</div>
      </div>
    </div>
  )
}

export default function Stats() {
  const [leagueId, setLeagueId] = useState('')
  const [leagues, setLeagues] = useState([])
  const [category, setCategory] = useState('points')
  const [leaders, setLeaders] = useState([])
  const [playersData, setPlayersData] = useState([])
  const [playersCount, setPlayersCount] = useState(0)
  const [teamsCount, setTeamsCount] = useState(0)
  const [gamesCount, setGamesCount] = useState(0)
  const [liveGames, setLiveGames] = useState(0)
  const [upcomingGames, setUpcomingGames] = useState(0)
  const [recentGames, setRecentGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingLeaders, setLoadingLeaders] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get('/api/leagues')
      .then((res) => {
        const leagueList = Array.isArray(res.data) ? res.data : []
        setLeagues(leagueList)
        if (leagueList.length) {
          const preferred = leagueList.find((league) => league.status === 'active')
            || leagueList.find((league) => league.status === 'upcoming')
            || leagueList[0]
          setLeagueId(String(preferred.league_id))
        }
      })
      .catch(() => setLeagues([]))
  }, [])

  useEffect(() => {
    async function loadOverview() {
      setLoading(true)
      setError('')

      try {
        const [playersRes, teamsRes, gamesRes, liveRes, upcomingRes] = await Promise.all([
          axios.get('/api/players'),
          axios.get('/api/teams'),
          axios.get('/api/games'),
          axios.get('/api/games?status=live'),
          axios.get('/api/games?status=upcoming')
        ])

        const selectedPlayers = leagueId
          ? playersRes.data.filter((player) => Number(player.league_id) === Number(leagueId))
          : playersRes.data
        const selectedTeams = leagueId
          ? teamsRes.data.filter((team) => Number(team.league_id) === Number(leagueId))
          : teamsRes.data
        const selectedGames = leagueId
          ? gamesRes.data.filter((game) => Number(game.league_id) === Number(leagueId))
          : gamesRes.data
        const selectedLive = liveRes.data.filter((game) => !leagueId || Number(game.league_id) === Number(leagueId))
        const selectedUpcoming = upcomingRes.data.filter((game) => !leagueId || Number(game.league_id) === Number(leagueId))

        setPlayersCount(selectedPlayers.length)
        setPlayersData(selectedPlayers)
        setTeamsCount(selectedTeams.length)
        setGamesCount(selectedGames.length)
        setLiveGames(selectedLive.length)
        setUpcomingGames(selectedUpcoming.length)
        setRecentGames(selectedGames.slice(0, 5))

      } catch (err) {
        console.error(err)
        setError('Failed to load statistics. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadOverview()
  }, [leagueId])

  useEffect(() => {
    if (!leagueId) return
    setLoadingLeaders(true)

    axios.get(`/api/players/leaders/${leagueId}?category=${category}`)
      .then((res) => setLeaders(res.data.slice(0, 5)))
      .catch((err) => {
        console.error(err)
        setLeaders([])
      })
      .finally(() => setLoadingLeaders(false))
  }, [leagueId, category])

  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <div style={{ padding: 28, minHeight: '100%', color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Statistics</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 560 }}>
            Explore verified player performance, leaderboard categories, and the latest league games in one place.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            style={{ minWidth: 220, padding: '8px 10px', borderRadius: 8, background: '#1e2330', border: '1px solid #ffffff22', color: '#ffffff', cursor: 'pointer' }}
          >
            {leagues.length === 0 && <option value="">Loading leagues...</option>}
            {leagues.map((league) => (
              <option key={league.league_id} value={String(league.league_id)}>
                {league.name}{league.status ? ` (${league.status})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Verified Players" value={loading ? '…' : playersCount} color="var(--orange)" />
        <StatCard label="Teams" value={loading ? '…' : teamsCount} color="#38bdf8" />
        <StatCard label="Games" value={loading ? '…' : gamesCount} color="#a78bfa" />
        <StatCard label="Live Games" value={loading ? '…' : liveGames} color="#ef4444" />
        <StatCard label="Upcoming" value={loading ? '…' : upcomingGames} color="#f59e0b" />
      </div>

      {error ? (
        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(239,68,68,0.12)', color: '#b91c1c' }}>{error}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Leaderboard</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Top performers by category</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {statCategories.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setCategory(item.key)}
                    style={{
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 999,
                      border: item.key === category ? `1px solid ${item.color}` : '1px solid var(--border)',
                      background: item.key === category ? `${item.color}15` : 'transparent',
                      color: item.key === category ? item.color : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {loadingLeaders ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading leaders...</div>
              ) : leaders.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No leaderboard data available yet.</div>
              ) : (
                leaders.map((player, index) => (
                  <LeaderCard
                    key={player.player_id}
                    rank={index + 1}
                    player={player}
                    statLabel={statCategories.find((item) => item.key === category)?.shortLabel || 'PPG'}
                    color={statCategories.find((item) => item.key === category)?.color || 'var(--orange)'}
                  />
                ))
              )}
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Season Snapshot</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                This page pulls verified player averages and live game counts from the current league data.
                Use the leaderboard tabs to compare top performers across the core categories.
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Latest Games</div>
              {loading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading games…</div>
              ) : recentGames.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No recent games available.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {recentGames.map((game) => (
                    <div key={game.game_id} style={{
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      padding: 12,
                      background: 'var(--bg-panel)'
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {new Date(game.scheduled_time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                        {game.home_team_name} vs {game.away_team_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>{game.division || 'Open'} Division</span>
                        <span>·</span>
                        <span>{game.league_name || 'League'}</span>
                        <span>·</span>
                        <span>{game.status?.replace('_', ' ') || 'Scheduled'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
