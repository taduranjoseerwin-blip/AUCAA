const axios = require('axios')

const API = 'http://localhost:5000'
const admin = { username: 'admin', password: 'admin123' }

async function run() {
  try {
    console.log('Logging in...')
    const login = await axios.post(`${API}/api/auth/login`, admin)
    const token = login.data.token
    console.log('Token obtained')
    const headers = { Authorization: `Bearer ${token}` }

    console.log('Generating 4-team bracket...')
    const gen = await axios.post(`${API}/api/bracket/generate`, { league_id: 1, size: 4 }, { headers })
    console.log('Generated:', gen.data.games.map(g => g.game_id))

    const games = gen.data.games
    const g1 = games.find(g => g.bracket_round === 1 && g.bracket_slot === 1)
    if (!g1) throw new Error('Round 1 slot 1 not found')

    console.log('Setting score for game', g1.game_id)
    await axios.put(`${API}/api/games/${g1.game_id}/score`, { home_score: 80, away_score: 70, current_quarter: 4, status: 'completed' }, { headers })
    console.log('Advancing winner...')
    await axios.put(`${API}/api/bracket/${g1.game_id}/advance`, {}, { headers })

    const bracket = await axios.get(`${API}/api/bracket/1`)
    console.log('Final bracket games:', bracket.data.map(g => ({ id: g.game_id, home: g.home_team_id, away: g.away_team_id, round: g.bracket_round, slot: g.bracket_slot })))
    console.log('Test complete')
  } catch (err) {
    console.error('Test failed:', err.response ? err.response.data : err.message)
    process.exit(1)
  }
}

run()
