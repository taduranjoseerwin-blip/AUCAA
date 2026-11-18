const router = require('express').Router()
const db = require('../config/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

// GET /api/players/leaders/:leagueId — top players by stat category
// IMPORTANT: This must come BEFORE /:playerId routes to match correctly
router.get('/leaders/:leagueId', async (req, res) => {
  const { category = 'points' } = req.query
  const statCol = ['points','rebounds','assists','steals','blocks'].includes(category) ? category : 'points'
  try {
    const [rows] = await db.query(`
      SELECT
        p.player_id, p.name, p.profile_picture,
        t.team_name,
        COUNT(DISTINCT ps.game_id) AS games_played,
        ROUND(AVG(ps.points), 1) AS avg_points,
        ROUND(AVG(ps.rebounds), 1) AS avg_rebounds,
        ROUND(AVG(ps.assists), 1) AS avg_assists,
        ROUND(AVG(ps.steals), 1) AS avg_steals,
        ROUND(AVG(ps.blocks), 1) AS avg_blocks,
        ROUND(AVG(ps.${statCol}), 1) AS stat_value,
        ROUND(AVG(ps.${statCol}), 1) AS ppg
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.player_id
      JOIN teams t ON p.team_id = t.team_id
      JOIN games g ON ps.game_id = g.game_id AND g.league_id = t.league_id
      WHERE t.league_id = ?
        AND p.verification_status = 'verified'
        AND g.league_id = ?
      GROUP BY p.player_id, p.name, p.profile_picture, t.team_name
      ORDER BY stat_value DESC, p.name ASC
      LIMIT 10
    `, [req.params.leagueId, req.params.leagueId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch leaders.' })
  }
})

// SEARCH /api/players/search — player lookup for forms and matching
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json([])
    const search = `%${q}%`
    const [rows] = await db.query(`
      SELECT
        p.player_id, p.name, p.student_id, p.barangay,
        p.barangay_lat, p.barangay_lng, p.barangay_place_id,
        p.team_id, t.team_name, p.verification_status
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.team_id
      WHERE p.student_id LIKE ? OR p.name LIKE ? OR p.barangay LIKE ?
      ORDER BY FIELD(p.verification_status, 'verified', 'pending', 'rejected'), p.name
      LIMIT 30
    `, [search, search, search])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to search players.' })
  }
})

// GET /api/players/:playerId/stats — player stats
router.get('/:playerId/stats', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        ROUND(AVG(points), 1) AS ppg,
        ROUND(AVG(rebounds), 1) AS rpg,
        ROUND(AVG(assists), 1) AS apg,
        ROUND(AVG(steals), 1) AS spg,
        ROUND(AVG(blocks), 1) AS bpg,
        ROUND(AVG(fouls), 1) AS fpg,
        ROUND(SUM(CASE WHEN points > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 1) AS fg_pct
      FROM player_stats
      WHERE player_id = ?
    `, [req.params.playerId])
    res.json(rows.length > 0 ? rows[0] : {})
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch player stats.' })
  }
})

// GET /api/players — all players with full per-game averages
router.get('/', async (req, res) => {
  try {
    const { all } = req.query
    let query = `
      SELECT
        p.player_id, p.name, p.jersey_number, p.position, p.profile_picture,
        p.student_id, p.date_of_birth, p.height, p.weight, p.region, p.province, p.city, p.barangay,
        p.barangay_lat, p.barangay_lng, p.barangay_place_id,
        p.verification_status, p.verified_at, p.created_at,
        t.team_id, t.team_name, t.league_id,
        COALESCE(ROUND(AVG(ps.points), 1), 0) AS ppg,
        COALESCE(ROUND(AVG(ps.rebounds), 1), 0) AS rpg,
        COALESCE(ROUND(AVG(ps.assists), 1), 0) AS apg,
        COALESCE(ROUND(AVG(ps.steals), 1), 0) AS spg,
        COALESCE(ROUND(AVG(ps.blocks), 1), 0) AS bpg,
        COALESCE(ROUND(AVG(ps.fouls), 1), 0) AS fpg
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.team_id
      LEFT JOIN player_stats ps ON ps.player_id = p.player_id
    `
    if (!all) {
      query += ` WHERE p.verification_status = 'verified'`
    }
    query += `
      GROUP BY p.player_id, p.name, p.jersey_number, p.position, p.profile_picture, p.student_id, p.date_of_birth, p.height, p.weight, p.region, p.province, p.city, p.barangay, p.barangay_lat, p.barangay_lng, p.barangay_place_id, p.verification_status, p.verified_at, p.created_at, t.team_id, t.team_name, t.league_id
      ORDER BY p.name
    `
    const [rows] = await db.query(query)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch players.' })
  }
})

// POST /api/players — add player (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, team_id, jersey_number, position } = req.body
  if (!name || !team_id) return res.status(400).json({ message: 'Name and team are required.' })
  try {
    const [result] = await db.query(
      'INSERT INTO players (name, team_id, jersey_number, position, verification_status) VALUES (?, ?, ?, ?, ?)',
      [name, team_id, jersey_number, position, 'verified']
    )
    res.status(201).json({ message: 'Player added.', player_id: result.insertId })
  } catch (err) {
    res.status(500).json({ message: 'Failed to add player.' })
  }
})

module.exports = router