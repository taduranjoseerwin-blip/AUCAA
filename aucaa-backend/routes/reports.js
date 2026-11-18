const express = require('express')
const router = express.Router()
const db = require('../config/db')
const { authMiddleware } = require('../middleware/auth')

// Utility: Format CSV values
const formatCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

// Utility: Generate CSV from data
const generateCsv = (headers, rows) => {
  const headerRow = headers.map(formatCsvValue).join(',')
  const dataRows = rows.map((row) => row.map(formatCsvValue).join(','))
  return [headerRow, ...dataRows].join('\n')
}

// Utility: Generate PDF (simple text-based)
const generatePdf = (title, headers, rows) => {
  // For PDF, we'll use a simple format that can be opened with any PDF viewer
  // In production, use pdfkit or similar
  let content = `${title}\n`
  content += `Generated: ${new Date().toLocaleString()}\n\n`
  
  // Headers
  const colWidths = headers.map((h) => Math.max(h.length, 15))
  content += headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ')
  content += '\n'
  content += headers.map((h, i) => '-'.repeat(colWidths[i])).join('-+-')
  content += '\n'
  
  // Rows
  rows.forEach((row) => {
    content += row.map((v, i) => String(v).padEnd(colWidths[i])).join(' | ')
    content += '\n'
  })
  
  return content
}

// Report 1: Standings Report
router.get('/standings/:league_id', authMiddleware, async (req, res) => {
  try {
    const { league_id } = req.params
    const { format = 'csv' } = req.query

    // Fetch league info
    const [leagues] = await db.query(
      'SELECT name, season FROM leagues WHERE league_id = ?',
      [league_id]
    )
    const league = leagues[0]
    if (!league) return res.status(404).json({ error: 'League not found' })

    // Fetch standings
    const [standings] = await db.query(
      `SELECT t.team_name,
              COALESCE(COUNT(CASE WHEN g.home_team_id = t.team_id AND g.status = 'completed' AND g.home_score > g.away_score THEN 1 END), 0) +
              COALESCE(COUNT(CASE WHEN g.away_team_id = t.team_id AND g.status = 'completed' AND g.away_score > g.home_score THEN 1 END), 0) as wins,
              COALESCE(COUNT(CASE WHEN g.home_team_id = t.team_id AND g.status = 'completed' AND g.home_score < g.away_score THEN 1 END), 0) +
              COALESCE(COUNT(CASE WHEN g.away_team_id = t.team_id AND g.status = 'completed' AND g.away_score < g.home_score THEN 1 END), 0) as losses,
              COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.home_score ELSE 0 END) + 
                       SUM(CASE WHEN g.away_team_id = t.team_id THEN g.away_score ELSE 0 END), 0) as points_for,
              COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.away_score ELSE 0 END) + 
                       SUM(CASE WHEN g.away_team_id = t.team_id THEN g.home_score ELSE 0 END), 0) as points_against
       FROM teams t
       LEFT JOIN games g ON (g.home_team_id = t.team_id OR g.away_team_id = t.team_id) AND g.league_id = ?
       WHERE t.league_id = ?
       GROUP BY t.team_id, t.team_name
       ORDER BY wins DESC, (
         COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.home_score ELSE 0 END) + 
                  SUM(CASE WHEN g.away_team_id = t.team_id THEN g.away_score ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.away_score ELSE 0 END) + 
                  SUM(CASE WHEN g.away_team_id = t.team_id THEN g.home_score ELSE 0 END), 0)
       ) DESC`,
      [league_id, league_id]
    )

    const headers = ['Team', 'Wins', 'Losses', 'Points For', 'Points Against', 'Point Diff']
    const rows = standings.map((s) => {
      const wins = Number(s.wins) || 0
      const losses = Number(s.losses) || 0
      const pf = Number(s.points_for) || 0
      const pa = Number(s.points_against) || 0
      return [
        s.team_name || 'Unknown',
        wins.toString(),
        losses.toString(),
        pf.toString(),
        pa.toString(),
        (pf - pa).toString()
      ]
    })

    const title = `Standings Report - ${league.name} (${league.season || 'Season TBA'})`
    const content = format === 'pdf' ? generatePdf(title, headers, rows) : generateCsv(headers, rows)
    const filename = `standings-${league_id}-${new Date().getTime()}.${format === 'pdf' ? 'txt' : 'csv'}`

    res.setHeader('Content-Type', format === 'pdf' ? 'text/plain' : 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(content)
  } catch (error) {
    console.error('Standings Report error:', error.message, error.stack)
    res.status(500).json({ error: error.message })
  }
})

// Report 2: Player Statistics Report
router.get('/players/:league_id', authMiddleware, async (req, res) => {
  try {
    const { league_id } = req.params
    const { format = 'csv' } = req.query

    // Fetch league info
    const [leagues] = await db.query(
      'SELECT name, season FROM leagues WHERE league_id = ?',
      [league_id]
    )
    const league = leagues[0]
    if (!league) return res.status(404).json({ error: 'League not found' })

    // Fetch player stats
    const [players] = await db.query(
      `SELECT p.player_id, p.name, p.position, t.team_name,
              COALESCE(SUM(ps.points), 0) as total_points,
              COALESCE(AVG(ps.points), 0) as avg_points,
              COALESCE(SUM(ps.rebounds), 0) as total_rebounds,
              COALESCE(AVG(ps.rebounds), 0) as avg_rebounds,
              COALESCE(SUM(ps.assists), 0) as total_assists,
              COALESCE(AVG(ps.assists), 0) as avg_assists,
              COALESCE(COUNT(DISTINCT ps.game_id), 0) as games_played
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.team_id
       LEFT JOIN player_stats ps ON p.player_id = ps.player_id
       WHERE t.league_id = ?
       GROUP BY p.player_id, p.name, p.position, t.team_name
       ORDER BY total_points DESC, avg_points DESC`,
      [league_id]
    )

    const headers = ['Player', 'Position', 'Team', 'GP', 'Total Pts', 'Avg Pts', 'Total Reb', 'Avg Reb', 'Total Ast', 'Avg Ast']
    const rows = players.map((p) => {
      const totalPts = Number(p.total_points) || 0
      const avgPts = Number(p.avg_points) || 0
      const totalReb = Number(p.total_rebounds) || 0
      const avgReb = Number(p.avg_rebounds) || 0
      const totalAst = Number(p.total_assists) || 0
      const avgAst = Number(p.avg_assists) || 0
      const gp = Number(p.games_played) || 0
      
      return [
        p.name || 'Unknown',
        p.position || 'N/A',
        p.team_name || 'N/A',
        gp.toString(),
        Math.round(totalPts).toString(),
        avgPts.toFixed(2),
        Math.round(totalReb).toString(),
        avgReb.toFixed(2),
        Math.round(totalAst).toString(),
        avgAst.toFixed(2)
      ]
    })

    const title = `Player Statistics Report - ${league.name} (${league.season || 'Season TBA'})`
    const content = format === 'pdf' ? generatePdf(title, headers, rows) : generateCsv(headers, rows)
    const filename = `players-${league_id}-${new Date().getTime()}.${format === 'pdf' ? 'txt' : 'csv'}`

    res.setHeader('Content-Type', format === 'pdf' ? 'text/plain' : 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(content)
  } catch (error) {
    console.error('Player Stats Report error:', error.message, error.stack)
    res.status(500).json({ error: error.message })
  }
})

// Report 3: Game Statistics Report
router.get('/games/:league_id', authMiddleware, async (req, res) => {
  try {
    const { league_id } = req.params
    const { format = 'csv' } = req.query

    // Fetch league info
    const [leagues] = await db.query(
      'SELECT name, season FROM leagues WHERE league_id = ?',
      [league_id]
    )
    const league = leagues[0]
    if (!league) return res.status(404).json({ error: 'League not found' })

    // Fetch completed games
    const [games] = await db.query(
      `SELECT DATE_FORMAT(g.scheduled_time, '%Y-%m-%d %H:%i') as date_time,
              ht.team_name as home_team, g.home_score, at.team_name as away_team, g.away_score,
              g.venue, g.status
       FROM games g
       JOIN teams ht ON g.home_team_id = ht.team_id
       JOIN teams at ON g.away_team_id = at.team_id
       WHERE g.league_id = ? AND g.status IN ('completed', 'live', 'halftime')
       ORDER BY g.scheduled_time DESC`,
      [league_id]
    )

    const headers = ['Date/Time', 'Home Team', 'Score', 'Away Team', 'Score', 'Venue', 'Status']
    const rows = games.map((g) => {
      const homeScore = Number(g.home_score) || 0
      const awayScore = Number(g.away_score) || 0
      return [
        g.date_time || 'TBA',
        g.home_team || 'Unknown',
        homeScore.toString(),
        g.away_team || 'Unknown',
        awayScore.toString(),
        g.venue || 'N/A',
        g.status || 'Unknown'
      ]
    })

    const title = `Game Statistics Report - ${league.name} (${league.season || 'Season TBA'})`
    const content = format === 'pdf' ? generatePdf(title, headers, rows) : generateCsv(headers, rows)
    const filename = `games-${league_id}-${new Date().getTime()}.${format === 'pdf' ? 'txt' : 'csv'}`

    res.setHeader('Content-Type', format === 'pdf' ? 'text/plain' : 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(content)
  } catch (error) {
    console.error('Game Stats Report error:', error.message, error.stack)
    res.status(500).json({ error: error.message })
  }
})

// Report 4: League Overview Report
router.get('/league-overview/:league_id', authMiddleware, async (req, res) => {
  try {
    const { league_id } = req.params
    const { format = 'csv' } = req.query

    // Fetch league info
    const [leagues] = await db.query(
      'SELECT name, season, status, format FROM leagues WHERE league_id = ?',
      [league_id]
    )
    const league = leagues[0]
    if (!league) return res.status(404).json({ error: 'League not found' })

    // Fetch aggregate stats
    const [stats] = await db.query(
      `SELECT 
        COUNT(DISTINCT t.team_id) as total_teams,
        COUNT(DISTINCT p.player_id) as total_players,
        COUNT(DISTINCT g.game_id) as total_games,
        SUM(CASE WHEN g.status = 'completed' THEN 1 ELSE 0 END) as completed_games,
        SUM(CASE WHEN g.status = 'upcoming' THEN 1 ELSE 0 END) as upcoming_games,
        SUM(CASE WHEN g.status IN ('live', 'halftime') THEN 1 ELSE 0 END) as live_games
       FROM leagues l
       LEFT JOIN teams t ON l.league_id = t.league_id
       LEFT JOIN players p ON t.team_id = p.team_id
       LEFT JOIN games g ON l.league_id = g.league_id
       WHERE l.league_id = ?`,
      [league_id]
    )

    const stat = stats[0]

    // Simple headers and rows format
    const content = `League Overview Report
Generated: ${new Date().toLocaleString()}
================================================

League: ${league.name}
Season: ${league.season || 'TBA'}
Status: ${league.status}
Format: ${league.format}

Statistics:
- Total Teams: ${stat.total_teams}
- Total Players: ${stat.total_players}
- Total Games: ${stat.total_games}
- Completed Games: ${stat.completed_games}
- Upcoming Games: ${stat.upcoming_games}
- Live/Halftime Games: ${stat.live_games}
================================================
`

    const filename = `overview-${league_id}-${new Date().getTime()}.${format === 'pdf' ? 'txt' : 'txt'}`

    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(content)
  } catch (error) {
    console.error('League Overview Report error:', error.message, error.stack)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
