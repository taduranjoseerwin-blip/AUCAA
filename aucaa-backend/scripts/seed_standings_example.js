const db = require('../config/db')

async function seedStandingsExample() {
  try {
    const [existingLeagues] = await db.query('SELECT league_id FROM leagues WHERE name = ?', ['Example Basketball League'])
    let leagueId

    if (existingLeagues.length) {
      leagueId = existingLeagues[0].league_id
    } else {
      const [leagueResult] = await db.query(
        "INSERT INTO leagues (name, season, status, format) VALUES (?, ?, ?, ?)",
        ['Example Basketball League', '2026-2027', 'active', 'elimination']
      )
      leagueId = leagueResult.insertId
    }

    const teamNames = ['Camarines Knights', 'Naga Eagles', 'Pili Tigers', 'Bicol Warriors', 'Ocampo Falcons', 'Iriga Bears']
    const teamIds = []

    for (const teamName of teamNames) {
      const [existingTeams] = await db.query('SELECT team_id FROM teams WHERE league_id = ? AND team_name = ?', [leagueId, teamName])
      if (existingTeams.length) {
        teamIds.push(existingTeams[0].team_id)
      } else {
        const [teamResult] = await db.query('INSERT INTO teams (team_name, league_id, division) VALUES (?, ?, ?)', [teamName, leagueId, 'Open'])
        teamIds.push(teamResult.insertId)
      }
    }

    const [existingGames] = await db.query("SELECT COUNT(*) AS count FROM games WHERE league_id = ? AND venue = 'Example Data'", [leagueId])
    if (Number(existingGames[0].count) === 0) {
      const scores = [
        [92, 78], [88, 84], [101, 95], [79, 72], [96, 90],
        [82, 76], [105, 99], [91, 87], [74, 70], [98, 94],
        [86, 80], [89, 83], [103, 97], [77, 73], [94, 88]
      ]
      let scoreIndex = 0
      for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
          const [homeScore, awayScore] = scores[scoreIndex++]
          await db.query(
            "INSERT INTO games (league_id, home_team_id, away_team_id, home_score, away_score, status, venue, scheduled_time) VALUES (?, ?, ?, ?, ?, 'completed', 'Example Data', NOW())",
            [leagueId, teamIds[i], teamIds[j], homeScore, awayScore]
          )
        }
      }
    }

    console.log(`Example standings seeded for league_id ${leagueId}.`)
    console.log(`Teams: ${teamNames.length} | Completed games: 15`)
  } finally {
    await db.end()
  }
}

seedStandingsExample().catch((err) => {
  console.error('Failed to seed example standings:', err.message)
  process.exit(1)
})
