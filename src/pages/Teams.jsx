import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const res = await axios.get('/api/leagues')
        const leagueList = Array.isArray(res.data) ? res.data : []
        setLeagues(leagueList)
        if (leagueList.length > 0) {
          const preferred = leagueList.find((league) => league.status === 'active')
            || leagueList.find((league) => league.status === 'upcoming')
            || leagueList[0]
          setSelectedLeague(String(preferred.league_id))
        }
      } catch (_) {
        setLeagues([])
      }
    }
    loadLeagues()
  }, [])

  useEffect(() => {
    const loadTeams = async () => {
      if (!selectedLeague) return
      setLoading(true)
      try {
        const res = await axios.get(`/api/teams?league_id=${selectedLeague}`)
        setTeams(res.data)
      } catch (_) {
        setTeams([])
      } finally {
        setLoading(false)
      }
    }
    loadTeams()
  }, [selectedLeague])

  return (
    <div style={{ padding: 24, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 2 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Teams</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {leagues.find((league) => Number(league.league_id) === Number(selectedLeague))?.name || 'All leagues'}
          </div>
        </div>
        <select
          value={selectedLeague}
          onChange={(event) => setSelectedLeague(event.target.value)}
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

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-panel)' }}>
            <tr>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Team</th>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Division</th>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-muted)', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Roster</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading teams...</td>
              </tr>
            )}
            {!loading && teams.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No teams available yet.</td>
              </tr>
            )}
            {teams.map(team => (
              <tr key={team.team_id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontWeight: 600 }}>{team.team_name}</td>
                <td style={{ padding: 12, color: 'var(--text-muted)' }}>{team.division || 'Open'}</td>
                <td style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)' }}>{team.player_count != null ? `${team.player_count} players` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}