const router = require('express').Router()
const db = require('../config/db')
const { authMiddleware, rolesOnly } = require('../middleware/auth')

// GET /api/leagues — list all leagues with format metadata
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT league_id, name, season, status, format FROM leagues ORDER BY league_id')
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch leagues.' })
  }
})

// GET /api/leagues/:id — get league details
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT league_id, name, season, status, format FROM leagues WHERE league_id = ?', [req.params.id])
    if (!rows.length) return res.status(404).json({ message: 'League not found.' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch league.' })
  }
})

// POST /api/leagues — create a new league
router.post('/', authMiddleware, rolesOnly('admin'), async (req, res) => {
  const { name, season, status, format } = req.body
  const validFormats = ['elimination', 'round_robin']
  const validStatuses = ['active', 'completed', 'upcoming']
  if (!name) return res.status(400).json({ message: 'League name is required.' })
  if (format && !validFormats.includes(format)) return res.status(400).json({ message: 'Invalid league format.' })
  if (status && !validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid league status.' })

  try {
    const [result] = await db.query(
      'INSERT INTO leagues (name, season, status, format) VALUES (?, ?, ?, ?)',
      [name, season || null, status || 'upcoming', format || 'elimination']
    )
    const [rows] = await db.query('SELECT league_id, name, season, status, format FROM leagues WHERE league_id = ?', [result.insertId])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to create league.' })
  }
})

// PATCH /api/leagues/:id — update league configuration
router.patch('/:id', authMiddleware, rolesOnly('admin'), async (req, res) => {
  const { name, season, status, format } = req.body
  const validFormats = ['elimination', 'round_robin']
  const validStatuses = ['active', 'completed', 'upcoming']
  const updates = []
  const params = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(name)
  }
  if (season !== undefined) {
    updates.push('season = ?')
    params.push(season)
  }
  if (status !== undefined) {
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid league status.' })
    updates.push('status = ?')
    params.push(status)
  }
  if (format !== undefined) {
    if (!validFormats.includes(format)) return res.status(400).json({ message: 'Invalid league format.' })
    updates.push('format = ?')
    params.push(format)
  }

  if (!updates.length) return res.status(400).json({ message: 'No fields to update.' })
  params.push(req.params.id)

  try {
    const [result] = await db.query(`UPDATE leagues SET ${updates.join(', ')} WHERE league_id = ?`, params)
    if (result.affectedRows === 0) return res.status(404).json({ message: 'League not found.' })
    const [rows] = await db.query('SELECT league_id, name, season, status, format FROM leagues WHERE league_id = ?', [req.params.id])
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update league.' })
  }
})

// DELETE /api/leagues/:id — delete a league and remove all league-linked data while preserving individual players
router.delete('/:id', authMiddleware, rolesOnly('admin'), async (req, res) => {
  const leagueId = req.params.id
  const conn = await db.getConnection()

  try {
    await conn.beginTransaction()

    const [teamRows] = await conn.query('SELECT team_id FROM teams WHERE league_id = ?', [leagueId])
    const teamIds = teamRows.map(team => team.team_id)

    if (teamIds.length) {
      const teamPlaceholders = teamIds.map(() => '?').join(', ')
      await conn.query(`UPDATE players SET team_id = NULL WHERE team_id IN (${teamPlaceholders})`, teamIds)
    }

    if (teamIds.length) {
      const teamPlaceholders = teamIds.map(() => '?').join(', ')
      const [gameRows] = await conn.query(
        `SELECT game_id FROM games WHERE league_id = ? OR home_team_id IN (${teamPlaceholders}) OR away_team_id IN (${teamPlaceholders})`,
        [leagueId, ...teamIds, ...teamIds]
      )
      const gameIds = gameRows.map(row => row.game_id)

      if (gameIds.length) {
        const gamePlaceholders = gameIds.map(() => '?').join(', ')
        try {
          await conn.query(`DELETE FROM game_logs WHERE game_id IN (${gamePlaceholders})`, gameIds)
        } catch (err) {
          if (err.code !== 'ER_NO_SUCH_TABLE') throw err
        }
        await conn.query(`DELETE FROM player_stats WHERE game_id IN (${gamePlaceholders})`, gameIds)
      }

      await conn.query(
        `UPDATE games SET next_game_id = NULL, winner_team_id = NULL, bracket_id = NULL, home_team_id = NULL, away_team_id = NULL WHERE league_id = ? OR home_team_id IN (${teamPlaceholders}) OR away_team_id IN (${teamPlaceholders})`,
        [leagueId, ...teamIds, ...teamIds]
      )
      await conn.query(
        `DELETE FROM games WHERE league_id = ? OR home_team_id IN (${teamPlaceholders}) OR away_team_id IN (${teamPlaceholders})`,
        [leagueId, ...teamIds, ...teamIds]
      )
    } else {
      const [gameRows] = await conn.query('SELECT game_id FROM games WHERE league_id = ?', [leagueId])
      const gameIds = gameRows.map(row => row.game_id)

      if (gameIds.length) {
        const gamePlaceholders = gameIds.map(() => '?').join(', ')
        try {
          await conn.query(`DELETE FROM game_logs WHERE game_id IN (${gamePlaceholders})`, gameIds)
        } catch (err) {
          if (err.code !== 'ER_NO_SUCH_TABLE') throw err
        }
        await conn.query(`DELETE FROM player_stats WHERE game_id IN (${gamePlaceholders})`, gameIds)
      }

      await conn.query('UPDATE games SET next_game_id = NULL, winner_team_id = NULL, bracket_id = NULL WHERE league_id = ?', [leagueId])
      await conn.query('DELETE FROM games WHERE league_id = ?', [leagueId])
    }

    try {
      await conn.query('DELETE FROM bracket_audit WHERE league_id = ?', [leagueId])
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err
    }

    try {
      await conn.query('DELETE FROM brackets WHERE league_id = ?', [leagueId])
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err
    }

    await conn.query('DELETE FROM teams WHERE league_id = ?', [leagueId])

    const [result] = await conn.query('DELETE FROM leagues WHERE league_id = ?', [leagueId])
    if (result.affectedRows === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'League not found.' })
    }

    await conn.commit()
    res.json({ message: 'League deleted.' })
  } catch (err) {
    console.error(err)
    try { await conn.rollback() } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr) }
    res.status(500).json({ message: err.message || 'Failed to delete league.' })
  } finally {
    try { conn.release() } catch (releaseErr) { console.error('Release failed:', releaseErr) }
  }
})

module.exports = router
