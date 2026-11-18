const router = require('express').Router()
const db = require('../config/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')
const { sendGameNotificationEmail } = require('../config/mailer')

// GET /api/games — get all games (with team names)
router.get('/', async (req, res) => {
  const { status } = req.query
  try {
    let query = `
      SELECT g.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name,
        l.name AS league_name,
        ht.division
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      JOIN leagues l ON g.league_id = l.league_id
    `
    const params = []
    if (status) { query += ' WHERE g.status = ?'; params.push(status) }
    query += ' ORDER BY g.scheduled_time DESC'

    const [rows] = await db.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch games.' })
  }
})

// GET /api/games/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT g.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name,
        l.name AS league_name,
        ht.division
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      JOIN leagues l ON g.league_id = l.league_id
      WHERE g.game_id = ?
    `, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Game not found.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch game.' })
  }
})

// POST /api/games — create game (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { league_id, home_team_id, away_team_id, venue, scheduled_time } = req.body
  if (!league_id || !home_team_id || !away_team_id || !scheduled_time)
    return res.status(400).json({ message: 'Missing required fields.' })
  try {
    const [result] = await db.query(
      'INSERT INTO games (league_id, home_team_id, away_team_id, venue, scheduled_time) VALUES (?, ?, ?, ?, ?)',
      [league_id, home_team_id, away_team_id, venue, scheduled_time]
    )

    // Fetch team names and league name for announcement
    const [gameData] = await db.query(`
      SELECT g.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name,
        l.name AS league_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      JOIN leagues l ON g.league_id = l.league_id
      WHERE g.game_id = ?
    `, [result.insertId])

    const game = gameData[0]
    const gameDate = new Date(game.scheduled_time).toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    const gameTime = new Date(game.scheduled_time).toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit'
    })

    // Create announcement for fans
    const announcementTitle = `🏀 Game Scheduled: ${game.home_team_name} vs ${game.away_team_name}`
    const announcementMessage = `${game.league_name}\n\n${game.home_team_name} will face ${game.away_team_name}\n\n📅 Date: ${gameDate}\n⏰ Time: ${gameTime}\n📍 Venue: ${game.venue || 'TBA'}`
    
    await db.query(
      'INSERT INTO announcements (title, message, type, author_id) VALUES (?, ?, ?, ?)',
      [announcementTitle, announcementMessage, 'schedule', req.user.id]
    )

    try {
      const [users] = await db.query(
        "SELECT email, username FROM users WHERE status = 'approved' AND email IS NOT NULL AND email <> ''"
      )
      await Promise.allSettled(
        users.map((user) => sendGameNotificationEmail(
          user.email,
          announcementTitle,
          announcementMessage,
          user.username
        ))
      )
    } catch (mailErr) {
      console.error('[Games] bulk game notification email failed:', mailErr)
    }

    // Emit Socket.IO event to notify fans in real-time
    const io = req.app.get('io')
    io?.emit('gameScheduled', {
      game_id: game.game_id,
      title: announcementTitle,
      message: announcementMessage,
      scheduled_time: game.scheduled_time
    })

    res.status(201).json({ message: 'Game created and fans notified.', game_id: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to create game.' })
  }
})

// PUT /api/games/:id/score — update score (admin only)
router.put('/:id/score', authMiddleware, adminOnly, async (req, res) => {
  const { home_score, away_score, current_quarter, status } = req.body
  const gameId = Number(req.params.id)
  const finalHomeScore = Number(home_score)
  const finalAwayScore = Number(away_score)
  const finalQuarter = current_quarter !== undefined ? Number(current_quarter) : null
  const finalStatus = status || 'live'

  try {
    await db.query(
      'UPDATE games SET home_score = ?, away_score = ?, current_quarter = ?, status = ? WHERE game_id = ?',
      [finalHomeScore, finalAwayScore, finalQuarter, finalStatus, gameId]
    )

    const io = req.app.get('io')
    const payload = {
      gameId,
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      currentQuarter: finalQuarter,
      status: finalStatus,
    }

    io?.to(`game_${gameId}`).emit('scoreUpdate', payload)
    io?.to(`game_${gameId}`).emit('statusUpdate', payload)
    io?.emit('scheduleUpdated', { action: 'score_changed', ...payload })

    res.json({ message: 'Score updated.' })
  } catch (err) {
    console.error('[Games] score update failed', err)
    res.status(500).json({ message: 'Failed to update score.' })
  }
})

// PATCH /api/games/:id — update game details with announcement (admin only)
router.patch('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { venue, scheduled_time } = req.body
  try {
    // Get current game data
    const [currentGame] = await db.query(`
      SELECT g.*, 
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name,
        l.name AS league_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      JOIN leagues l ON g.league_id = l.league_id
      WHERE g.game_id = ?
    `, [req.params.id])

    if (currentGame.length === 0) {
      return res.status(404).json({ message: 'Game not found.' })
    }

    const game = currentGame[0]

    // Update game details
    const updates = []
    const values = []
    if (venue !== undefined) { updates.push('venue = ?'); values.push(venue) }
    if (scheduled_time !== undefined) { updates.push('scheduled_time = ?'); values.push(scheduled_time) }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' })
    }

    values.push(req.params.id)
    await db.query(`UPDATE games SET ${updates.join(', ')} WHERE game_id = ?`, values)

    // If scheduled_time changed, create announcement
    if (scheduled_time && scheduled_time !== game.scheduled_time) {
      const gameDate = new Date(scheduled_time).toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
      const gameTime = new Date(scheduled_time).toLocaleTimeString('en-US', { 
        hour: '2-digit', minute: '2-digit'
      })

      const announcementTitle = `📅 Game Rescheduled: ${game.home_team_name} vs ${game.away_team_name}`
      const announcementMessage = `${game.league_name}\n\nThe game has been rescheduled!\n\n${game.home_team_name} vs ${game.away_team_name}\n\n📅 New Date: ${gameDate}\n⏰ New Time: ${gameTime}\n📍 Venue: ${venue || game.venue || 'TBA'}`
      
      await db.query(
        'INSERT INTO announcements (title, message, type, author_id) VALUES (?, ?, ?, ?)',
        [announcementTitle, announcementMessage, 'schedule', req.user.id]
      )

      try {
        const [users] = await db.query(
          "SELECT email, username FROM users WHERE status = 'approved' AND email IS NOT NULL AND email <> ''"
        )
        await Promise.allSettled(
          users.map((user) => sendGameNotificationEmail(
            user.email,
            announcementTitle,
            announcementMessage,
            user.username
          ))
        )
      } catch (mailErr) {
        console.error('[Games] bulk reschedule notification email failed:', mailErr)
      }

      // Emit Socket.IO event
      const io = req.app.get('io')
      io?.emit('gameRescheduled', {
        game_id: game.game_id,
        title: announcementTitle,
        message: announcementMessage,
        scheduled_time: scheduled_time
      })
    }

    res.json({ message: 'Game updated.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update game.' })
  }
})

// GET /api/games/:id/stats — get all player stats for a game
router.get('/:id/stats', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ps.stat_id, ps.game_id, ps.player_id, 
             COALESCE(ps.points, 0) AS points,
             COALESCE(ps.rebounds, 0) AS rebounds,
             COALESCE(ps.assists, 0) AS assists,
             COALESCE(ps.steals, 0) AS steals,
             COALESCE(ps.blocks, 0) AS blocks,
             COALESCE(ps.fouls, 0) AS fouls,
             COALESCE(ps.turnovers, 0) AS turnovers,
             p.name, p.jersey_number, p.position
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.player_id
      WHERE ps.game_id = ?
      ORDER BY p.name
    `, [req.params.id])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch game stats.' })
  }
})

// DELETE /api/games/:id — delete game and associated announcement (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Fetch game details first
    const [gameData] = await db.query(`
      SELECT g.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      WHERE g.game_id = ?
    `, [req.params.id])

    if (gameData.length === 0) {
      return res.status(404).json({ message: 'Game not found.' })
    }

    const game = gameData[0]

    // Delete dependent stat and log rows before removing the game itself.
    await db.query('DELETE FROM player_stats WHERE game_id = ?', [req.params.id])

    try {
      await db.query('DELETE FROM game_logs WHERE game_id = ?', [req.params.id])
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        throw err
      }
    }

    await db.query('DELETE FROM games WHERE game_id = ?', [req.params.id])

    // Emit Socket.IO event
    const io = req.app.get('io')
    io?.emit('gameDeleted', {
      game_id: req.params.id,
      matchup: `${game.home_team_name} vs ${game.away_team_name}`
    })

    res.json({ message: 'Game and associated announcements deleted.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to delete game.' })
  }
})

module.exports = router
