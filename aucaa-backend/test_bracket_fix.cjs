require('dotenv').config()
const axios = require('axios')
const jwt = require('jsonwebtoken')

;(async () => {
  try {
    const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'test')
    console.log('Testing bracket generation for league 1, size 2...')
    const res = await axios.post('http://localhost:5000/api/bracket/generate', 
      { league_id: 1, size: 2 }, 
      { headers: { Authorization: 'Bearer ' + token } }
    )
    console.log('\n✅ SUCCESS! Bracket generated:')
    console.log('Games created:', res.data.games.length)
    res.data.games.forEach((g, i) => {
      console.log(`  Game ${i+1}: Round ${g.bracket_round} Slot ${g.bracket_slot} - ${g.home_team_name} vs ${g.away_team_name}`)
    })
  } catch(err) {
    console.error('❌ ERROR:', err?.response?.data || err.message)
  }
  process.exit(0)
})()
