const router = require('express').Router()
const db = require('../config/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

// GET /api/teams
router.get('/', async (req, res) => {
  const { league_id } = req.query
  try {
    let query = 'SELECT * FROM teams'
    const params = []
    if (league_id) { query += ' WHERE league_id = ?'; params.push(league_id) }
    query += ' ORDER BY team_name'
    const [rows] = await db.query(query, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch teams.' })
  }
})

// POST /api/teams — add team (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { team_name, league_id, division } = req.body
  if (!team_name || !league_id) return res.status(400).json({ message: 'Team name and league are required.' })
  try {
    const [result] = await db.query(
      'INSERT INTO teams (team_name, league_id, division) VALUES (?, ?, ?)',
      [team_name, league_id, division || 'Open']
    )
    res.status(201).json({ message: 'Team added.', team_id: result.insertId })
  } catch (err) {
    res.status(500).json({ message: 'Failed to add team.' })
  }
})

module.exports = router
