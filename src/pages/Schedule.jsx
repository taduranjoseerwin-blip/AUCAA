import { useEffect, useState } from 'react'
import axios from 'axios'
import { useSocket } from '../hooks/useSocket'

function formatMatchTime(time) {
  return new Date(time).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function Schedule() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const socket = useSocket()

  const loadGames = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/games')
      const list = Array.isArray(res.data) ? res.data.slice() : []
      list.sort((a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time))
      setGames(list)
    } catch (_) {
      setGames([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGames()
  }, [])

  useEffect(() => {
    socket.on('scheduleUpdated', loadGames)
    return () => {
      socket.off('scheduleUpdated', loadGames)
    }
  }, [socket])

  const liveGames = games.filter(g => g.status === 'live')
  const upcomingGames = games.filter(g => g.status === 'upcoming')
  const completedGames = games.filter(g => g.status === 'completed')

  const renderSection = (title, gamesList) => (
    <div key={title}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        {gamesList.map(game => (
          <div key={game.game_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }} onMouseOver={e => e.currentTarget.style.borderColor = 'var(--orange)'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {game.home_team_name} vs {game.away_team_name}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                {formatMatchTime(game.scheduled_time)} · {game.venue || 'Venue TBA'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ padding: 32, minHeight: '100%', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          Schedule
        </div>
      </div>

      <div style={{ maxWidth: 960 }}>
        {loading && (
          <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 12, color: 'var(--text-muted)' }}>
            Loading schedule...
          </div>
        )}

        {!loading && games.length === 0 && (
          <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 12, color: 'var(--text-muted)' }}>
            No scheduled games yet. Check back later for the latest schedule.
          </div>
        )}

        {!loading && games.length > 0 && (
          <div>
            {liveGames.length > 0 && renderSection('Live Now', liveGames)}
            {upcomingGames.length > 0 && renderSection('Upcoming', upcomingGames)}
            {completedGames.length > 0 && renderSection('Completed', completedGames)}
            {liveGames.length === 0 && upcomingGames.length === 0 && completedGames.length === 0 && (
              <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 12, color: 'var(--text-muted)' }}>
                No games found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
