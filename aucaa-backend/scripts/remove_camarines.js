const db = require('../config/db')

;(async () => {
  try {
    console.log('Connecting to DB and removing seeded Camarines/Masbate entries...')
    // Remove player_stats for sample game 3 (if exists)
    await db.query('DELETE FROM player_stats WHERE game_id = ?', [3])

    // Remove any games involving teams 5 or 6
    await db.query('DELETE FROM games WHERE home_team_id IN (?, ?) OR away_team_id IN (?, ?)', [5,6,5,6])

    // Remove players belonging to those teams
    await db.query('DELETE FROM players WHERE team_id IN (?, ?)', [5,6])

    // Remove the teams themselves
    await db.query('DELETE FROM teams WHERE team_id IN (?, ?)', [5,6])

    console.log('Seeded teams/games/players removed (if present).')
    process.exit(0)
  } catch (err) {
    console.error('Failed to remove seeded rows:', err)
    process.exit(1)
  }
})()
