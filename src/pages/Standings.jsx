import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/ConfirmModal'

export default function Standings() {
  const [standings, setStandings] = useState([])
  const [games, setGames] = useState([])
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState(null)

  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const res = await axios.get('/api/leagues')
        const leagueList = res.data || []
        setLeagues(leagueList)

        if (!selectedLeague && leagueList.length > 0) {
          const preferred = leagueList.find((item) => item.status === 'active')
            || leagueList.find((item) => item.status === 'upcoming')
            || leagueList[0]
          setSelectedLeague(String(preferred.league_id))
        }
      } catch (err) {
        console.error('Failed to load leagues:', err)
      }
    }
    loadLeagues()
  }, [])

  const loadData = () => {
    if (!selectedLeague) return
    setLoading(true)
    Promise.all([
      axios.get(`/api/standings/${selectedLeague}`),
      axios.get('/api/games')
    ])
      .then(([standingsRes, gamesRes]) => {
        setStandings(standingsRes.data)
        setGames(gamesRes.data.filter((game) => Number(game.league_id) === Number(selectedLeague)))
      })
      .catch(() => {
        setStandings([])
        setGames([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [selectedLeague])

  const compareStandings = (a, b) => {
  if (a.wins !== b.wins) return b.wins - a.wins
  if (a.point_diff !== b.point_diff) return b.point_diff - a.point_diff
  if ((a.points_for ?? 0) !== (b.points_for ?? 0)) return (b.points_for ?? 0) - (a.points_for ?? 0)
  if ((a.points_against ?? 0) !== (b.points_against ?? 0)) return (a.points_against ?? 0) - (b.points_against ?? 0)
  return a.team_name.localeCompare(b.team_name)
}

const buildSeededStandings = (standings) => {
  return standings.slice().sort(compareStandings).map((team, index) => ({
    ...team,
    seed: index + 1
  }))
}

const buildTieBreakerGroups = (standings) => {
  const groups = []
  let currentGroup = []

  for (let i = 0; i < standings.length; i++) {
    const team = standings[i]
    const prev = standings[i - 1]
    const tiedWithPrev = prev &&
      team.wins === prev.wins &&
      team.point_diff === prev.point_diff &&
      team.points_for === prev.points_for &&
      team.points_against === prev.points_against

    if (tiedWithPrev) {
      if (!currentGroup.length) currentGroup = [prev]
      currentGroup.push(team)
    } else {
      if (currentGroup.length > 1) groups.push(currentGroup)
      currentGroup = []
    }
  }

  if (currentGroup.length > 1) groups.push(currentGroup)
  return groups
}

const buildTieBreakerGames = (groups) => {
  return groups.flatMap((group) => {
    const games = []
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        games.push({
          teamA: group[i],
          teamB: group[j],
          type: group.length === 2 ? 'Decision game' : 'Round-robin tie-breaker'
        })
      }
    }
    return games
  })
}

const getGameResult = (game, team) => {
  if (!game || game.home_score == null || game.away_score == null) return null
  const isHome = game.home_team_id === team.team_id
  const score = isHome ? game.home_score : game.away_score
  const opponentScore = isHome ? game.away_score : game.home_score
  const opponentName = isHome ? game.away_team_name : game.home_team_name
  const outcome = score > opponentScore ? 'W' : score < opponentScore ? 'L' : 'T'
  return {
    result: `${outcome} ${score}-${opponentScore}`,
    opponent: opponentName,
    status: game.status
  }
}

const findGameBetween = (games, teamA, teamB) => {
  return games.find((g) =>
    (g.home_team_id === teamA.team_id && g.away_team_id === teamB.team_id) ||
    (g.home_team_id === teamB.team_id && g.away_team_id === teamA.team_id)
  )
}

const normalizeStage = (stage) => {
  if (!stage) return ''
  return stage.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const buildPlayoffBracket = (standings, games) => {
  const semifinalGames = games.filter((game) => game.bracket_stage === 'semifinal')
  if (semifinalGames.length >= 2) {
    return semifinalGames.slice(0, 2).map((game, index) => {
      const teamA = standings.find((team) => team.team_id === game.home_team_id) || { team_id: game.home_team_id, team_name: game.home_team_name, seed: '-' }
      const teamB = standings.find((team) => team.team_id === game.away_team_id) || { team_id: game.away_team_id, team_name: game.away_team_name, seed: '-' }
      const winner = game.home_score != null && game.away_score != null
        ? (game.home_score > game.away_score ? teamA : game.home_score < game.away_score ? teamB : null)
        : null

      return {
        title: `Semifinal ${index + 1}`,
        stage: normalizeStage(game.bracket_stage),
        teamA,
        teamB,
        game,
        resultA: getGameResult(game, teamA),
        resultB: getGameResult(game, teamB),
        winner
      }
    })
  }

  const seeds = standings.slice(0, 4)
  if (seeds.length < 4) return []
  const matchups = [
    { title: 'Semifinal 1', teamA: seeds[0], teamB: seeds[3] },
    { title: 'Semifinal 2', teamA: seeds[1], teamB: seeds[2] }
  ]

  return matchups.map((match) => {
    const game = findGameBetween(games, match.teamA, match.teamB)
    const winner = game && game.home_score != null && game.away_score != null
      ? (game.home_score > game.away_score
          ? (game.home_team_id === match.teamA.team_id ? match.teamA : match.teamB)
          : (game.away_team_id === match.teamA.team_id ? match.teamA : match.teamB))
      : null

    return {
      ...match,
      stage: 'Semifinal',
      game,
      resultA: getGameResult(game, match.teamA),
      resultB: getGameResult(game, match.teamB),
      winner
    }
  })
}

const buildFinalMatch = (bracket, games) => {
  const finalGame = games.find((game) => game.bracket_stage === 'final')
  if (finalGame) {
    const teamA = { team_id: finalGame.home_team_id, team_name: finalGame.home_team_name, seed: bracket.find((b) => b.teamA.team_id === finalGame.home_team_id)?.teamA.seed || bracket.find((b) => b.teamB.team_id === finalGame.home_team_id)?.teamB.seed || '-' }
    const teamB = { team_id: finalGame.away_team_id, team_name: finalGame.away_team_name, seed: bracket.find((b) => b.teamA.team_id === finalGame.away_team_id)?.teamA.seed || bracket.find((b) => b.teamB.team_id === finalGame.away_team_id)?.teamB.seed || '-' }
    return {
      title: 'Finals',
      stage: normalizeStage(finalGame.bracket_stage),
      teamA,
      teamB,
      game: finalGame,
      resultA: getGameResult(finalGame, teamA),
      resultB: getGameResult(finalGame, teamB)
    }
  }

  if (!bracket.length || !bracket[0]?.winner || !bracket[1]?.winner) return null
  const teamA = bracket[0].winner
  const teamB = bracket[1].winner
  const game = findGameBetween(games, teamA, teamB)
  return {
    title: 'Finals',
    stage: 'Final',
    teamA,
    teamB,
    game,
    resultA: getGameResult(game, teamA),
    resultB: getGameResult(game, teamB)
  }
}

const getAdvancement = (rank, total) => {
    if (rank === 1 || rank === 2) return { label: 'Finals', color: 'var(--orange)', bg: 'var(--orange-glow)' }
    if (rank <= 4) return { label: 'Semis', color: 'var(--blue)', bg: 'rgba(59,130,246,0.12)' }
    return { label: 'Eliminated', color: 'var(--text-muted)', bg: 'transparent' }
  }

  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [creatingTieBreakers, setCreatingTieBreakers] = useState(false)
  const [tieBreakerMessage, setTieBreakerMessage] = useState('')

  const seededStandings = buildSeededStandings(standings)
  const tieBreakGroups = buildTieBreakerGroups(seededStandings)
  const tieBreakerGames = buildTieBreakerGames(tieBreakGroups)
  const playoffBracket = buildPlayoffBracket(seededStandings, games)
  const finalMatch = buildFinalMatch(playoffBracket, games)

  const completedGamesCount = games.filter((game) => game.status === 'completed' || game.status === 'forfeited').length
  const totalTeamAppearances = standings.reduce((total, team) => total + Number(team.wins || 0) + Number(team.losses || 0), 0)
  const averageLeaguePoints = totalTeamAppearances > 0
    ? standings.reduce((total, team) => total + Number(team.points_for || 0), 0) / totalTeamAppearances
    : 0

  return (
    <div className="feed-area">
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

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>League <span style={{ color: 'var(--orange)' }}>Standings</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            style={{ minWidth: 220, padding: '8px 10px', borderRadius: 8, background: '#1e2330', border: '1px solid #ffffff22', color: '#ffffff', cursor: 'pointer' }}
          >
            {leagues.length === 0 && <option value="">Loading leagues...</option>}
            {leagues.map((item) => (
              <option key={item.league_id} value={String(item.league_id)}>
                {item.name} ({item.status})
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-updated after each game</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Seeding & tie-breakers</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            Seeds are generated from league standings using wins, point differential, points for, and points against. When two or more teams remain tied on all primary metrics, actual tie-breaker games can be created for those teams.
          </div>
          {isAdmin && tieBreakGroups.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setConfirmState({
                    title: 'Create tie-breakers',
                    message: 'Create tie-breaker game(s) for exact standings ties?',
                    confirmText: 'Create',
                    tone: 'warning',
                    icon: 'ti-exchange-vertical',
                    onConfirm: async () => {
                      setConfirmState(null)
                      setCreatingTieBreakers(true)
                      setTieBreakerMessage('')
                      try {
                        const res = await axios.post(`/api/standings/${selectedLeague}/tiebreakers`)
                        setTieBreakerMessage(res.data.message)
                        loadData()
                      } catch (err) {
                        setTieBreakerMessage(err?.response?.data?.message || 'Failed to create tie-breaker games.')
                      } finally {
                        setCreatingTieBreakers(false)
                      }
                    },
                    onClose: () => setConfirmState(null),
                  })
                }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--orange)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                disabled={creatingTieBreakers}
              >
                {creatingTieBreakers ? 'Creating...' : 'Create Tie-breaker Games'}
              </button>
              {tieBreakerMessage && <div style={{ fontSize: 11, color: '#22c55e' }}>{tieBreakerMessage}</div>}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {tieBreakerGames.length > 0 ? (
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tie-breaker decision games</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {tieBreakerGames.map((game, index) => (
                  <div key={`${game.teamA.team_id}-${game.teamB.team_id}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 10, background: 'rgba(249,115,22,0.06)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{game.teamA.team_name} vs {game.teamB.team_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{game.type} for seeds {game.teamA.seed} and {game.teamB.seed}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)' }}>Pending</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              No tie-breaker decision games are needed for the current standings.
            </div>
          )}
        </div>
        {playoffBracket.length > 0 && (
          <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Playoff bracket</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {playoffBracket.map((match) => (
                <div key={match.title} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, background: 'rgba(59,130,246,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{match.title}</div>
                      {match.stage && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{match.stage}</div>}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{match.teamA.team_name} (Seed {match.teamA.seed}) vs {match.teamB.team_name} (Seed {match.teamB.seed})</div>
                    </div>
                    <div style={{ padding: '6px 10px', borderRadius: 999, background: 'var(--orange-glow)', color: 'var(--orange)', fontSize: 11, fontWeight: 700 }}>
                      {match.game ? 'Played' : 'Scheduled'}
                    </div>
                  </div>
                  {match.game && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Result</div>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{match.resultA?.result || 'TBD'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{match.resultA?.opponent || '-'}</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Result</div>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{match.resultB?.result || 'TBD'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{match.resultB?.opponent || '-'}</div>
                      </div>
                    </div>
                  )}
                  {match.winner && (
                    <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700 }}>Winner: {match.winner.team_name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {finalMatch && (
          <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Finals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{finalMatch.teamA.team_name} (Seed {finalMatch.teamA.seed}) vs {finalMatch.teamB.team_name} (Seed {finalMatch.teamB.seed})</div>
              {finalMatch.stage && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{finalMatch.stage}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{finalMatch.game ? 'Final matchup from scheduled or completed final game.' : 'Final matchup determined from semifinal winners.'}</div>
              {finalMatch.game && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                  <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Result</div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{finalMatch.resultA?.result || 'TBD'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{finalMatch.resultA?.opponent || '-'}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Result</div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{finalMatch.resultB?.result || 'TBD'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{finalMatch.resultB?.opponent || '-'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Summary row */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {['Total Teams', 'Games Played', 'Avg Points', 'League Leader'].map((label, i) => (
            <div key={i} style={{ flex: 1, padding: '14px 16px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: i === 3 ? 'var(--orange)' : 'var(--text)' }}>
                {i === 0 && standings.length}
                {i === 1 && completedGamesCount}
                {i === 2 && averageLeaguePoints.toFixed(1)}
                {i === 3 && (standings[0]?.team_name?.split(' ')[0] || '—')}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['#', 'Team', 'W', 'L', 'PCT', 'PF', 'PA', 'DIFF', 'Status'].map((h, i) => (
                <th key={h} style={{
                  padding: '10px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                  textAlign: i <= 1 ? 'left' : 'center'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="9" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            )}
            {!loading && standings.length === 0 && (
              <tr><td colSpan="9" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No standings data available.</td></tr>
            )}
            {seededStandings.map((team, i) => {
              const adv = getAdvancement(team.seed, seededStandings.length)
              const diff = team.point_diff
              return (
                <tr key={team.team_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: i < 2 ? 'var(--orange)' : 'var(--text-muted)', width: 32 }}>{team.seed}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{team.team_name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--green)' }}>{team.wins}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--live)' }}>{team.losses}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: i < 2 ? 'var(--orange)' : 'var(--text)' }}>
                    {Number(team.win_pct).toFixed(3)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{team.points_for}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{team.points_against}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: diff >= 0 ? 'var(--green)' : 'var(--live)' }}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700,
                      background: adv.bg, color: adv.color
                    }}>{adv.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}