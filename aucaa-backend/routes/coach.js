const router = require('express').Router()
const db = require('../config/db')
const { authMiddleware } = require('../middleware/auth')
const { sendAccountApprovedEmail, sendAccountRejectedEmail } = require('../config/mailer')

// Middleware to ensure user is a coach
function coachOnly(req, res, next) {
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Access denied. Coach role required.' })
  next()
}

router.get('/verifications', authMiddleware, coachOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.player_id, p.name, p.student_id, p.jersey_number, p.position,
             p.date_of_birth, p.height, p.weight, p.barangay,
              p.team_id, p.verification_status, p.verified_at, p.created_at,
             u.username, u.email, u.status AS account_status,
             t.team_name
      FROM players p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN teams t ON t.team_id = p.team_id
      WHERE u.role = 'player' AND u.parent_user_id = ?
      ORDER BY FIELD(p.verification_status, 'pending', 'verified', 'rejected'), p.created_at DESC
    `, [req.user.id])
    res.json(rows)
  } catch (err) {
    console.error('[Coach] failed to fetch player verifications:', err)
    res.status(500).json({ message: 'Failed to fetch player verifications.' })
  }
})

router.patch('/verifications/:playerId', authMiddleware, coachOnly, async (req, res) => {
  const { status, team_id } = req.body
  if (!['verified', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' })
  }

  try {
    const [[player]] = await db.query(`
      SELECT p.player_id, p.user_id, u.username, u.email
      FROM players p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.player_id = ? AND u.role = 'player' AND u.parent_user_id = ?
    `, [req.params.playerId, req.user.id])
    if (!player) return res.status(404).json({ message: 'Player verification not found.' })

    let assignedTeamId = null
    if (status === 'verified') {
      if (team_id !== undefined && team_id !== null && team_id !== '') {
        assignedTeamId = Number(team_id)
        if (!Number.isSafeInteger(assignedTeamId)) {
          return res.status(400).json({ message: 'Invalid team.' })
        }
        const [[team]] = await db.query(
          'SELECT team_id FROM teams WHERE team_id = ? AND coach_id = ?',
          [assignedTeamId, req.user.id]
        )
        if (!team) return res.status(403).json({ message: 'You can only assign players to your own teams.' })
      } else {
        const [teams] = await db.query(
          'SELECT team_id FROM teams WHERE coach_id = ? ORDER BY created_at, team_id LIMIT 2',
          [req.user.id]
        )
        if (teams.length === 1) assignedTeamId = teams[0].team_id
      }
    }

    await db.query(
      'UPDATE players SET verification_status = ?, team_id = ?, verified_at = ? WHERE player_id = ?',
      [status, assignedTeamId, status === 'verified' ? new Date() : null, req.params.playerId]
    )
    const accountStatus = status === 'verified' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'
    await db.query('UPDATE users SET status = ? WHERE id = ?', [accountStatus, player.user_id])

    let notificationSent = false
    if (status === 'verified' || status === 'rejected') {
      try {
        const sendEmail = status === 'verified' ? sendAccountApprovedEmail : sendAccountRejectedEmail
        const result = await sendEmail(player.email, player.username)
        notificationSent = result.sent === true
      } catch (err) {
        console.error(`[Coach] player ${status} email failed:`, err.message || err)
      }
    }

    req.app.get('io')?.emit('verificationUpdated', {
      action: status,
      verification_type: 'player',
      player_id: Number(req.params.playerId),
    })
    res.json({
      message: status === 'verified'
        ? assignedTeamId ? 'Player verified and assigned to your team.' : 'Player verified.'
        : `Player ${status}.`,
      notification_email_sent: status === 'verified' || status === 'rejected' ? notificationSent : null,
    })
  } catch (err) {
    console.error('[Coach] failed to update player verification:', err)
    res.status(500).json({ message: 'Failed to update player verification.' })
  }
})

// Registration codes created by a coach belong to that coach's player group.
router.get('/regcodes', authMiddleware, coachOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM reg_codes WHERE parent_user_id = ? AND role = \'player\' ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch player codes.' })
  }
})

router.post('/regcodes', authMiddleware, coachOnly, async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ message: 'Code is required.' })
  try {
    await db.query(
      'INSERT INTO reg_codes (code, role, parent_user_id) VALUES (?, \'player\', ?)',
      [code, req.user.id]
    )
    res.status(201).json({ message: 'Player registration code created.' })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Code already exists.' })
    res.status(500).json({ message: 'Failed to create player code.' })
  }
})

router.delete('/regcodes/:id', authMiddleware, coachOnly, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM reg_codes WHERE id = ? AND parent_user_id = ? AND role = \'player\'',
      [req.params.id, req.user.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Player registration code not found.' })
    }
    res.json({ message: 'Player registration code deleted.' })
  } catch (err) {
    console.error('[Coach] failed to delete registration code:', err)
    res.status(500).json({ message: 'Failed to delete player registration code.' })
  }
})

// ── GET /api/coach/teams — list teams for this coach ──────────
router.get('/teams', authMiddleware, coachOnly, async (req, res) => {
  try {
    const userId = req.user.id
    const query = `
      SELECT t.team_id, t.team_name, t.league_id, t.division, t.created_at,
             l.name AS league_name, l.season, l.status AS league_status,
             COUNT(p.player_id) AS roster_count
      FROM teams t
      LEFT JOIN leagues l ON t.league_id = l.league_id
      LEFT JOIN players p ON t.team_id = p.team_id AND p.verification_status = 'verified'
      WHERE t.coach_id = ?
      GROUP BY t.team_id, t.team_name, t.league_id, t.division, t.created_at,
               l.name, l.season, l.status
      ORDER BY t.created_at DESC
    `
    const [rows] = await db.query(query, [userId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch coach teams.' })
  }
})

// ── GET /api/coach/teams/:teamId/roster — get roster for a team ──
router.get('/teams/:teamId/roster', authMiddleware, coachOnly, async (req, res) => {
  try {
    const { teamId } = req.params
    const userId = req.user.id

    // Verify coach owns this team
    const [team] = await db.query('SELECT coach_id FROM teams WHERE team_id = ?', [teamId])
    if (!team.length || team[0].coach_id !== userId)
      return res.status(403).json({ message: 'You do not have access to this team.' })

    // Get roster
    const [rows] = await db.query(`
      SELECT p.player_id, p.name, p.jersey_number, p.position, p.student_id,
             p.date_of_birth, p.height, p.weight, p.barangay,
             p.verification_status, p.verified_at, p.created_at
      FROM players p
      WHERE p.team_id = ?
      ORDER BY p.jersey_number, p.name
    `, [teamId])

    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch team roster.' })
  }
})

// ── POST /api/coach/players — add player to coach's team ────────
router.post('/players', authMiddleware, coachOnly, async (req, res) => {
  try {
    const { team_id, player_id, name, jersey_number, position, student_id, date_of_birth, height, weight, barangay } = req.body
    const userId = req.user.id

    // Verify coach owns this team
    const [team] = await db.query('SELECT coach_id FROM teams WHERE team_id = ?', [team_id])
    if (!team.length || team[0].coach_id !== userId)
      return res.status(403).json({ message: 'You do not have access to this team.' })

    // Case 1: Add existing verified player to roster
    if (player_id) {
      const [player] = await db.query('SELECT player_id FROM players WHERE player_id = ? AND verification_status = ?', [player_id, 'verified'])
      if (!player.length)
        return res.status(400).json({ message: 'Player not found or not verified.' })

      await db.query('UPDATE players SET team_id = ? WHERE player_id = ?', [team_id, player_id])
      const [updated] = await db.query('SELECT * FROM players WHERE player_id = ?', [player_id])
      return res.status(200).json(updated[0])
    }

    // Case 2: Register new player directly to roster (coach registration)
    if (!name || !team_id)
      return res.status(400).json({ message: 'Player name and team are required.' })

    const [result] = await db.query(
      `INSERT INTO players 
       (name, team_id, student_id, date_of_birth, height, weight, barangay, 
        jersey_number, position, verification_status, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [name, team_id, student_id || null, date_of_birth || null, height || null, 
       weight || null, barangay || null, jersey_number || null, position || null, 'verified']
    )

    const [newPlayer] = await db.query('SELECT * FROM players WHERE player_id = ?', [result.insertId])
    res.status(201).json(newPlayer[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to add player to roster.' })
  }
})

// ── PATCH /api/coach/players/:playerId — update player ─────────
router.patch('/players/:playerId', authMiddleware, coachOnly, async (req, res) => {
  try {
    const { playerId } = req.params
    const { name, jersey_number, position, date_of_birth, height, weight, barangay, student_id, team_id } = req.body
    const userId = req.user.id

    // Verify the player belongs to this coach, then validate any selected team.
    const [player] = await db.query(`
      SELECT p.player_id FROM players p
      INNER JOIN users u ON p.user_id = u.id
      WHERE p.player_id = ? AND u.parent_user_id = ?
    `, [playerId, userId])

    if (!player.length) return res.status(403).json({ message: 'Player not found under your management.' })

    let selectedTeamId = team_id
    if (team_id !== undefined && team_id !== null && team_id !== '') {
      selectedTeamId = Number(team_id)
      if (!Number.isSafeInteger(selectedTeamId)) return res.status(400).json({ message: 'Invalid team.' })
      const [team] = await db.query('SELECT team_id FROM teams WHERE team_id = ? AND coach_id = ?', [selectedTeamId, userId])
      if (!team.length) return res.status(403).json({ message: 'You can only assign players to your own teams.' })
    } else if (team_id !== undefined) {
      selectedTeamId = null
    }

    const updates = []
    const params = []

    if (name !== undefined) { updates.push('name = ?'); params.push(name) }
    if (jersey_number !== undefined) { updates.push('jersey_number = ?'); params.push(jersey_number) }
    if (position !== undefined) { updates.push('position = ?'); params.push(position) }
    if (date_of_birth !== undefined) { updates.push('date_of_birth = ?'); params.push(date_of_birth) }
    if (height !== undefined) { updates.push('height = ?'); params.push(height) }
    if (weight !== undefined) { updates.push('weight = ?'); params.push(weight) }
    if (barangay !== undefined) { updates.push('barangay = ?'); params.push(barangay) }
    if (student_id !== undefined) { updates.push('student_id = ?'); params.push(student_id) }
    if (team_id !== undefined) { updates.push('team_id = ?'); params.push(selectedTeamId) }

    if (!updates.length)
      return res.status(400).json({ message: 'No fields to update.' })

    params.push(playerId)
    await db.query(`UPDATE players SET ${updates.join(', ')} WHERE player_id = ?`, params)

    const [updated] = await db.query('SELECT * FROM players WHERE player_id = ?', [playerId])
    res.json(updated[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update player.' })
  }
})

// ── DELETE /api/coach/players/:playerId — remove player from roster ─
router.delete('/players/:playerId', authMiddleware, coachOnly, async (req, res) => {
  try {
    const { playerId } = req.params
    const userId = req.user.id

    // Verify player belongs to coach's team
    const [player] = await db.query(`
      SELECT p.player_id FROM players p
      INNER JOIN teams t ON p.team_id = t.team_id
      WHERE p.player_id = ? AND t.coach_id = ?
    `, [playerId, userId])

    if (!player.length)
      return res.status(403).json({ message: 'Player not found in your roster.' })

    // Remove player from team (set team_id to NULL and revert to pending status)
    await db.query('UPDATE players SET team_id = NULL, verification_status = ? WHERE player_id = ?', ['pending', playerId])
    res.json({ message: 'Player removed from roster.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to remove player.' })
  }
})

// ── GET /api/coach/verified-players — get verified players available to add ─
router.get('/verified-players', authMiddleware, coachOnly, async (req, res) => {
  try {
    const userId = req.user.id
    const [rows] = await db.query(`
      SELECT p.player_id, p.name, p.student_id, p.jersey_number, p.position,
             p.height, p.weight, p.barangay, p.date_of_birth
      FROM players p
      WHERE p.verification_status = 'verified' AND p.team_id IS NULL
      ORDER BY p.name
    `)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch verified players.' })
  }
})

module.exports = router
