const router = require('express').Router()
const multer = require('multer')
const db = require('../config/db')
const fs = require('fs')
const path = require('path')
const { authMiddleware, adminOnly, rolesOnly } = require('../middleware/auth')
const { sendAccountApprovedEmail, sendAccountRejectedEmail, sendAnnouncementEmail } = require('../config/mailer')
const { URL } = require('url')

const isValidUrl = (value) => {
  if (!value) return true
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol)
  } catch (_) {
    return false
  }
}

// Ensure highlight uploads directory exists
const highlightUploadsDir = path.join(__dirname, '../uploads/highlights')
if (!fs.existsSync(highlightUploadsDir)) {
  fs.mkdirSync(highlightUploadsDir, { recursive: true })
}

const highlightStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, highlightUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `highlight_${Date.now()}${ext}`)
  }
})

const highlightUpload = multer({
  storage: highlightStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (extname && mimetype) return cb(null, true)
    cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'))
  },
  limits: { fileSize: 5 * 1024 * 1024 }
})

// All admin routes require auth + admin/league_manager role
router.use(authMiddleware, adminOnly)

async function syncPlayerUserStatuses() {
  await db.query(`
    UPDATE users u
    JOIN players p ON p.user_id = u.id
    SET u.status = CASE
      WHEN p.verification_status = 'verified' THEN 'approved'
      WHEN p.verification_status = 'pending' THEN 'pending'
      WHEN p.verification_status = 'rejected' THEN 'rejected'
      ELSE u.status
    END
    WHERE u.role = 'player'
  `)
}

// ── DASHBOARD STATS ─────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    await syncPlayerUserStatuses()
    const [[users]]    = await db.query("SELECT COUNT(*) AS count FROM users WHERE status = 'approved'")
    const [[teams]]    = await db.query('SELECT COUNT(*) AS count FROM teams')
    const [[players]]  = await db.query("SELECT COUNT(*) AS count FROM players WHERE verification_status = 'verified'")
    const [[games]]    = await db.query(`
      SELECT COUNT(*) AS count
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
    `)
    const [[live]]      = await db.query(`
      SELECT COUNT(*) AS count
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      WHERE g.status = 'live'
    `)
    const pendingQuery = req.user?.role === 'league_manager'
      ? [
          `SELECT COUNT(*) AS count
           FROM users
           WHERE status = 'pending' AND role = 'coach' AND parent_user_id = ?`,
          [req.user.id]
        ]
      : [
          `SELECT COUNT(*) AS count
           FROM users u
           LEFT JOIN players p ON p.user_id = u.id
           WHERE u.status = 'pending'
             AND ((u.role = 'player' AND p.player_id IS NOT NULL)
               OR u.role IN ('coach', 'league_manager'))`,
          []
        ]
    const [[pending]] = await db.query(...pendingQuery)
    const [[regcodes]] = await db.query('SELECT COUNT(*) AS count FROM reg_codes WHERE used = 0')

    res.json({
      total_users:    users.count,
      total_teams:    teams.count,
      total_players:  players.count,
      total_games:    games.count,
      live_games:     live.count,
      pending_users:  pending.count,
      active_codes:   regcodes.count
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch dashboard stats.' })
  }
})

// ── USER MANAGEMENT ──────────────────────────────────────────
// GET all verified users (pending accounts remain in Verification)
router.get('/users', rolesOnly('admin'), async (req, res) => {
  try {
    await syncPlayerUserStatuses()
    const [rows] = await db.query(`
      SELECT u.id, u.username, u.email, u.role, u.status, u.created_at
      FROM users u
      WHERE u.status IN ('approved', 'rejected')
      ORDER BY u.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users.' })
  }
})

// PATCH update user status (activate/suspend)
router.patch('/users/:id/status', rolesOnly('admin'), async (req, res) => {
  const { status } = req.body
  if (!['approved', 'pending', 'rejected'].includes(status))
    return res.status(400).json({ message: 'Invalid status.' })
  try {
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id])
    res.json({ message: `User status updated to ${status}.` })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user status.' })
  }
})

// PATCH update user role
router.patch('/users/:id/role', rolesOnly('admin'), async (req, res) => {
  const { role } = req.body
  if (!['admin', 'league_manager', 'coach', 'player'].includes(role))
    return res.status(400).json({ message: 'Invalid role.' })
  try {
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id])
    res.json({ message: `User role updated to ${role}.` })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user role.' })
  }
})

// DELETE user
router.delete('/users/:id', rolesOnly('admin'), async (req, res) => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query('UPDATE teams SET coach_id = NULL WHERE coach_id = ?', [req.params.id])
    await connection.query('UPDATE announcements SET author_id = NULL WHERE author_id = ?', [req.params.id])
    await connection.query('DELETE FROM players WHERE user_id = ?', [req.params.id])
    await connection.query('DELETE FROM users WHERE id = ?', [req.params.id])
    await connection.commit()
    req.app.get('io')?.emit('verificationUpdated', { action: 'deleted', user_id: Number(req.params.id) })
    res.json({ message: 'User deleted.' })
  } catch (err) {
    await connection.rollback()
    console.error('Delete user error:', err)
    res.status(500).json({ message: 'Failed to delete user.' })
  } finally {
    connection.release()
  }
})

// ── ACCOUNT VERIFICATION ─────────────────────────────────────
// GET player registrations and coach account registrations awaiting review.
router.get('/verifications', async (req, res) => {
  try {
    const isLeagueManager = req.user?.role === 'league_manager'
    const playerScope = isLeagueManager
      ? 'WHERE 1 = 0'
      : ''
    const accountScope = isLeagueManager
      ? 'AND u.parent_user_id = ? AND u.role = \'coach\''
      : ''
    const queryParams = isLeagueManager ? [req.user.id] : []
    const [rows] = await db.query(`
      SELECT 'player' AS verification_type, p.player_id AS verification_id,
        p.user_id, u.username, u.email, u.role,
        p.name, p.jersey_number, p.position,
               p.verification_status, p.verified_at, p.student_id, p.created_at,
               p.date_of_birth, p.height, p.weight, p.barangay, p.profile_picture,
                 t.team_name, parent_user.id AS parent_user_id,
                 (SELECT pt.team_name FROM teams pt
                  WHERE pt.coach_id = parent_user.id
                  ORDER BY pt.created_at ASC, pt.team_id ASC LIMIT 1) AS parent_team_name
      FROM players p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN teams t ON p.team_id = t.team_id
       LEFT JOIN users parent_user ON parent_user.id = u.parent_user_id
       ${playerScope}
      UNION ALL
      SELECT 'account' AS verification_type, u.id AS verification_id,
        u.id AS user_id, u.username, u.email, u.role,
        u.username AS name, NULL, NULL,
        CASE u.status WHEN 'approved' THEN 'verified' WHEN 'rejected' THEN 'rejected' ELSE 'pending' END,
        NULL, NULL, u.created_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
      FROM users u
      WHERE u.role IN ('coach', 'league_manager')
        ${accountScope}
      ORDER BY FIELD(verification_status, 'pending', 'verified', 'rejected'), created_at DESC
    `, queryParams)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch verifications.' })
  }
})

// PATCH verify or reject a player or account
router.patch('/verifications/:id', async (req, res) => {
  const { status, verification_type = 'player' } = req.body
  if (!['verified', 'rejected', 'pending'].includes(status))
    return res.status(400).json({ message: 'Invalid status.' })
  try {
    if (!['player', 'account'].includes(verification_type))
      return res.status(400).json({ message: 'Invalid verification type.' })

    if (verification_type === 'account') {
      const [[targetAccount]] = await db.query('SELECT role FROM users WHERE id = ?', [req.params.id])
      if (!targetAccount) return res.status(404).json({ message: 'Account not found.' })
      if (targetAccount.role === 'league_manager' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can verify League Manager accounts.' })
      }
      const accountStatus = status === 'verified' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'
      await db.query('UPDATE users SET status = ? WHERE id = ?', [accountStatus, req.params.id])
      let approvalEmailSent = false
      let rejectionEmailSent = false
      if (status === 'verified') {
        const [[account]] = await db.query('SELECT email, username FROM users WHERE id = ?', [req.params.id])
        if (account?.email) {
          try {
            const result = await sendAccountApprovedEmail(account.email, account.username)
            approvalEmailSent = result.sent === true
          } catch (error) {
            console.error('[Account Approval Email]', error.message || error)
          }
        }
      } else if (status === 'rejected') {
        const [[account]] = await db.query('SELECT email, username FROM users WHERE id = ?', [req.params.id])
        if (account?.email) {
          try {
            const result = await sendAccountRejectedEmail(account.email, account.username)
            rejectionEmailSent = result.sent === true
          } catch (error) {
            console.error('[Account Rejection Email]', error.message || error)
          }
        }
      }
      req.app.get('io')?.emit('verificationUpdated', { action: status, verification_type })
      return res.json({
        message: `Account ${status}.`,
        approval_email_sent: status === 'verified' ? approvalEmailSent : null,
        rejection_email_sent: status === 'rejected' ? rejectionEmailSent : null
      })
    }

    const playerStatus = status === 'verified' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'
    let assignedTeamId = null

    if (status === 'verified') {
      const [parentTeams] = await db.query(`
        SELECT t.team_id
        FROM players p
        JOIN users player_user ON player_user.id = p.user_id
        JOIN teams t ON t.coach_id = player_user.parent_user_id
        WHERE p.player_id = ?
        ORDER BY t.created_at ASC, t.team_id ASC
      `, [req.params.id])

      // Auto-assign only when the parent coach has exactly one team.
      if (parentTeams.length === 1) assignedTeamId = parentTeams[0].team_id
    }

    if (status === 'verified') {
      await db.query('UPDATE players SET verification_status = ?, team_id = ?, verified_at = NOW() WHERE player_id = ?', [status, assignedTeamId, req.params.id])
    } else {
      await db.query('UPDATE players SET verification_status = ?, team_id = NULL, verified_at = NULL WHERE player_id = ?', [status, req.params.id])
    }

    await db.query(
      'UPDATE users SET status = ? WHERE id = (SELECT user_id FROM players WHERE player_id = ?)',
      [playerStatus, req.params.id]
    )

    if (status === 'verified' || status === 'rejected') {
      const [[playerAccount]] = await db.query(`
        SELECT u.email, u.username
        FROM players p
        JOIN users u ON u.id = p.user_id
        WHERE p.player_id = ?
      `, [req.params.id])
      let approvalEmailSent = false
      let rejectionEmailSent = false
      if (playerAccount?.email) {
        try {
          if (status === 'verified') {
            const result = await sendAccountApprovedEmail(playerAccount.email, playerAccount.username)
            approvalEmailSent = result.sent === true
          } else {
            const result = await sendAccountRejectedEmail(playerAccount.email, playerAccount.username)
            rejectionEmailSent = result.sent === true
          }
        } catch (error) {
          console.error(`[Player ${status} Email]`, error.message || error)
        }
      }
      req.app.get('io')?.emit('verificationUpdated', { action: status, verification_type })
      if (status === 'rejected') {
        return res.json({ message: 'Player rejected.', rejection_email_sent: rejectionEmailSent })
      }
        return res.json({
          message: assignedTeamId
            ? 'Player verified and assigned to the coach\'s team.'
            : 'Player verified. Assign a team from team management.',
          approval_email_sent: approvalEmailSent
        })
    }

    req.app.get('io')?.emit('verificationUpdated', { action: status, verification_type })
    res.json({ message: `Player ${status}${status === 'verified' ? ' and assigned to team.' : '.'}` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update verification.' })
  }
})

// DELETE player registration record (admin only)
router.delete('/players/:id', async (req, res) => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [players] = await connection.query('SELECT user_id FROM players WHERE player_id = ?', [req.params.id])
    if (players.length === 0) {
      await connection.rollback()
      return res.status(404).json({ message: 'Player record not found.' })
    }

    const userId = players[0].user_id
    await connection.query('DELETE FROM players WHERE player_id = ?', [req.params.id])
    if (userId) {
      await connection.query('DELETE FROM users WHERE id = ? AND role = \'player\'', [userId])
    }
    await connection.commit()
    req.app.get('io')?.emit('verificationUpdated', { action: 'deleted', player_id: Number(req.params.id), user_id: userId })
    res.json({ message: 'Player account and record deleted.' })
  } catch (err) {
    await connection.rollback()
    console.error(err)
    res.status(500).json({ message: 'Failed to delete player.' })
  } finally {
    connection.release()
  }
})

// PATCH update player bio/details (admin only)
router.patch('/players/:id', async (req, res) => {
  try {
    const allowed = ['name', 'student_id', 'date_of_birth', 'height', 'weight', 'barangay', 'jersey_number', 'position', 'team_id', 'verification_status']
    const fields = []
    const values = []
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        fields.push(`${key} = ?`)
        values.push(req.body[key])
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'verification_status')) {
      if (req.body.verification_status === 'verified') {
        fields.push('verified_at = ?')
        values.push(new Date())
      } else {
        fields.push('verified_at = ?')
        values.push(null)
      }
    }

    if (fields.length === 0) return res.status(400).json({ message: 'No valid fields to update.' })

    values.push(req.params.id)
    const sql = `UPDATE players SET ${fields.join(', ')} WHERE player_id = ?`
    await db.query(sql, values)

    // Return the updated player
    const [rows] = await db.query('SELECT * FROM players WHERE player_id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Player not found.' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update player.' })
  }
})

// ── REGISTRATION CODES ───────────────────────────────────────
router.get('/managed-coaches', async (req, res) => {
  if (req.user?.role !== 'league_manager') {
    return res.status(403).json({ message: 'League manager access required.' })
  }

  try {
    const [rows] = await db.query(`
      SELECT u.id, u.username, u.email, u.status, u.created_at,
             GROUP_CONCAT(DISTINCT t.team_name ORDER BY t.team_name SEPARATOR ', ') AS team_names
      FROM users u
      LEFT JOIN teams t ON t.coach_id = u.id
      WHERE u.role = 'coach' AND u.parent_user_id = ?
      GROUP BY u.id, u.username, u.email, u.status, u.created_at
      ORDER BY u.created_at DESC
    `, [req.user.id])
    res.json(rows)
  } catch (err) {
    console.error('[Admin] failed to fetch managed coaches:', err)
    res.status(500).json({ message: 'Failed to fetch managed coaches.' })
  }
})

// GET all reg codes
router.get('/regcodes', async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? '' : 'WHERE parent_user_id = ?'
    const params = req.user.role === 'admin' ? [] : [req.user.id]
    const [rows] = await db.query(
      `SELECT * FROM reg_codes ${filter} ORDER BY created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reg codes.' })
  }
})

// POST create new reg code
router.post('/regcodes', async (req, res) => {
  const { code, role } = req.body
  if (!code || !role) return res.status(400).json({ message: 'Code and role are required.' })
  if (!['admin', 'league_manager', 'coach', 'player', 'fan'].includes(role))
    return res.status(400).json({ message: 'Invalid role.' })
  if (req.user.role === 'league_manager' && role !== 'coach')
    return res.status(403).json({ message: 'League managers can only create coach codes.' })
  if (req.user.role === 'coach' && role !== 'player')
    return res.status(403).json({ message: 'Coaches can only create player codes.' })
  try {
    const parentUserId = ['league_manager', 'coach'].includes(req.user.role) ? req.user.id : null
    await db.query('INSERT INTO reg_codes (code, role, parent_user_id) VALUES (?, ?, ?)', [code, role, parentUserId])
    res.status(201).json({ message: 'Registration code created.' })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'Code already exists.' })
    res.status(500).json({ message: 'Failed to create reg code.' })
  }
})

// DELETE reg code
router.delete('/regcodes/:id', async (req, res) => {
  try {
    const query = req.user.role === 'league_manager'
      ? 'DELETE FROM reg_codes WHERE id = ? AND parent_user_id = ?'
      : 'DELETE FROM reg_codes WHERE id = ?'
    const params = req.user.role === 'league_manager' ? [req.params.id, req.user.id] : [req.params.id]
    const [result] = await db.query(query, params)
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Reg code not found.' })
    res.json({ message: 'Reg code deleted.' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete reg code.' })
  }
})

// ── TEAMS MANAGEMENT ─────────────────────────────────────────
// GET active coaches available for team assignment
router.get('/coaches', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, email FROM users WHERE role = 'coach' AND status = 'approved' ORDER BY username"
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch coaches.' })
  }
})

// GET all teams
router.get('/teams', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, coach.username AS coach_name,
             COUNT(CASE WHEN p.verification_status = 'verified' THEN 1 END) AS player_count
      FROM teams t
      LEFT JOIN players p ON p.team_id = t.team_id
      LEFT JOIN users coach ON coach.id = t.coach_id
      GROUP BY t.team_id, coach.username
      ORDER BY t.team_name
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch teams.' })
  }
})

// POST create team
router.post('/teams', async (req, res) => {
  const { team_name, division, league_id, coach_id } = req.body
  if (!team_name) return res.status(400).json({ message: 'Team name is required.' })
  if (!league_id) return res.status(400).json({ message: 'League is required.' })
  try {
    const [[league]] = await db.query('SELECT league_id FROM leagues WHERE league_id = ?', [league_id])
    if (!league) return res.status(400).json({ message: 'Selected league does not exist.' })
    const coachId = coach_id ? Number(coach_id) : null
    if (coachId !== null) {
      if (!Number.isSafeInteger(coachId)) return res.status(400).json({ message: 'Invalid coach.' })
      const [[coach]] = await db.query(
        "SELECT id FROM users WHERE id = ? AND role = 'coach' AND status = 'approved'",
        [coachId]
      )
      if (!coach) return res.status(400).json({ message: 'Selected coach is not active.' })
    }
    const [result] = await db.query(
      'INSERT INTO teams (team_name, division, league_id, coach_id) VALUES (?, ?, ?, ?)',
      [team_name.trim(), division || 'Open', league_id, coachId]
    )
    res.status(201).json({ message: 'Team created.', team_id: result.insertId })
  } catch (err) {
    console.error('[Team Create Error]', err.message, err.code)
    res.status(500).json({ message: 'Failed to create team.', error: err.message })
  }
})

// PATCH edit team
router.patch('/teams/:id', async (req, res) => {
  const { team_name, division, league_id, coach_id } = req.body
  if (!team_name) return res.status(400).json({ message: 'Team name is required.' })
  if (!league_id) return res.status(400).json({ message: 'League is required.' })
  try {
    const [[league]] = await db.query('SELECT league_id FROM leagues WHERE league_id = ?', [league_id])
    if (!league) return res.status(400).json({ message: 'Selected league does not exist.' })
    if (coach_id === undefined) {
      await db.query(
        'UPDATE teams SET team_name = ?, division = ?, league_id = ? WHERE team_id = ?',
        [team_name.trim(), division || 'Open', league_id, req.params.id]
      )
    } else {
      const coachId = coach_id ? Number(coach_id) : null
      if (coachId !== null) {
        if (!Number.isSafeInteger(coachId)) return res.status(400).json({ message: 'Invalid coach.' })
        const [[coach]] = await db.query(
          "SELECT id FROM users WHERE id = ? AND role = 'coach' AND status = 'approved'",
          [coachId]
        )
        if (!coach) return res.status(400).json({ message: 'Selected coach is not active.' })
      }
      await db.query(
        'UPDATE teams SET team_name = ?, division = ?, league_id = ?, coach_id = ? WHERE team_id = ?',
        [team_name.trim(), division || 'Open', league_id, coachId, req.params.id]
      )
    }
    res.json({ message: 'Team updated.' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update team.' })
  }
})

// DELETE team
router.delete('/teams/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM teams WHERE team_id = ?', [req.params.id])
    res.json({ message: 'Team deleted.' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete team.' })
  }
})

// ── GAMES MANAGEMENT ─────────────────────────────────────────
// GET all games
router.get('/games', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT g.*,
        l.name AS league_name,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name
      FROM games g
      LEFT JOIN leagues l ON g.league_id = l.league_id
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      ORDER BY g.scheduled_time DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch games.' })
  }
})

// POST create game
router.post('/games', async (req, res) => {
  const { league_id, home_team_id, away_team_id, scheduled_time, venue, bracket_stage } = req.body
  if (!league_id || !home_team_id || !away_team_id || !scheduled_time)
    return res.status(400).json({ message: 'League, teams, and schedule are required.' })
  const validBracketStages = ['quarterfinal', 'semifinal', 'final', 'third_place']
  if (bracket_stage && !validBracketStages.includes(bracket_stage))
    return res.status(400).json({ message: 'Invalid bracket stage.' })
  const scheduledDate = new Date(scheduled_time)
  if (Number.isNaN(scheduledDate.valueOf()) || scheduledDate < new Date())
    return res.status(400).json({ message: 'Cannot schedule games in the past. Please choose now or a future time.' })
  try {
    const [[league]] = await db.query('SELECT league_id FROM leagues WHERE league_id = ?', [league_id])
    if (!league) return res.status(400).json({ message: 'Selected league does not exist.' })

    const [teams] = await db.query(
      'SELECT team_id, league_id FROM teams WHERE team_id IN (?, ?)',
      [home_team_id, away_team_id]
    )
    if (teams.length !== 2) return res.status(400).json({ message: 'Both selected teams must exist.' })
    if (teams.some(team => String(team.league_id) !== String(league_id)))
      return res.status(400).json({ message: 'Both teams must belong to the selected league.' })

    const [result] = await db.query(
      'INSERT INTO games (league_id, home_team_id, away_team_id, scheduled_time, venue, status, bracket_stage) VALUES (?,?,?,?,?,?,?)',
      [league_id, home_team_id, away_team_id, scheduled_time, venue || '', 'upcoming', bracket_stage || null]
    )
    const io = req.app.get('io')
    io?.emit('scheduleUpdated', { action: 'created', gameId: result.insertId })
    res.status(201).json({ message: 'Game created.', game_id: result.insertId })
  } catch (err) {
    res.status(500).json({ message: 'Failed to create game.' })
  }
})

console.log('[Admin] registering highlight-image route')
router.post('/highlight-image', highlightUpload.single('image'), async (req, res) => {
  console.log('[Admin] highlight-image request', req.method, req.originalUrl)
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded.' })
    }

    const imagePath = `/uploads/highlights/${req.file.filename}`
    const dataFile = path.join(__dirname, '../data/highlight.json')

    if (fs.existsSync(dataFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
        if (existing.image && existing.image.startsWith('/uploads/highlights/')) {
          const oldFilename = path.basename(existing.image)
          const oldFilePath = path.join(__dirname, '../uploads/highlights', oldFilename)
          if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath)
        }
      } catch (_) {
        // ignore old image cleanup failures
      }
    }

    res.json({ message: 'Highlight image uploaded.', image: imagePath })
  } catch (err) {
    console.error('[Admin] highlight image upload failed', err)
    res.status(500).json({ message: 'Failed to upload highlight image.' })
  }
})

// ── Highlight link management (admin only) ─────────────────
router.get('/highlight-link', async (req, res) => {
  try {
    const file = path.join(__dirname, '../data/highlight.json')
    if (!fs.existsSync(file)) return res.json({ link: null, title: null, image: null })
    const content = fs.readFileSync(file, 'utf8')
    const obj = JSON.parse(content)
    res.json({
      link: obj.link || null,
      title: obj.title || null,
      image: obj.image || null
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to read highlight link.' })
  }
})

router.post('/highlight-link', async (req, res) => {
  try {
    console.log('[Admin] highlight-link save request', { user: req.user?.username, body: req.body })
    const { link, title, image } = req.body
    const dir = path.join(__dirname, '../data')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'highlight.json')
    const payload = {
      link: link || null,
      title: title || null,
      image: image || null
    }
    fs.writeFileSync(file, JSON.stringify(payload))
    const io = req.app.get('io')
    io?.emit('highlightUpdated', payload)
    res.json({ message: 'Highlight link saved.' })
  } catch (err) {
    console.error('[Admin] highlight-link save failed', err)
    res.status(500).json({ message: 'Failed to save highlight link.' })
  }
})

// PATCH update game status
router.patch('/games/:id/status', async (req, res) => {
  const { status, link } = req.body
  if (!['upcoming','live','halftime','completed','forfeited'].includes(status))
    return res.status(400).json({ message: 'Invalid status.' })
  if (status === 'live' && link && !isValidUrl(link))
    return res.status(400).json({ message: 'Invalid live stream URL. Use http:// or https://.' })
  try {
    if (status === 'live' && Object.prototype.hasOwnProperty.call(req.body, 'link')) {
      await db.query('UPDATE games SET status = ?, live_link = ? WHERE game_id = ?', [status, link || null, req.params.id])
    } else {
      await db.query('UPDATE games SET status = ? WHERE game_id = ?', [status, req.params.id])
    }

    const io = req.app.get('io')
    const gameId = Number(req.params.id)
    const payload = {
      action: 'status_changed',
      gameId,
      status,
      homeScore: null,
      awayScore: null,
      currentQuarter: null,
    }

    if (status === 'live') {
      const [[game]] = await db.query(`
        SELECT g.game_id, ht.team_name AS home_team_name, at.team_name AS away_team_name
        FROM games g
        JOIN teams ht ON g.home_team_id = ht.team_id
        JOIN teams at ON g.away_team_id = at.team_id
        WHERE g.game_id = ?
      `, [req.params.id])
      const livePayload = {
        action: 'live_started',
        gameId,
        status,
        home_team_name: game?.home_team_name || null,
        away_team_name: game?.away_team_name || null
      }
      io?.emit('gameLive', livePayload)
    }

    io?.to(`game_${gameId}`).emit('statusUpdate', payload)
    io?.emit('scheduleUpdated', payload)
    res.json({ message: `Game status set to ${status}.` })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update game status.' })
  }
})

// PATCH update game details (teams, venue, schedule)
router.patch('/games/:id', async (req, res) => {
  try {
    const allowed = ['home_team_id', 'away_team_id', 'scheduled_time', 'venue', 'bracket_stage']
    const fields = []
    const values = []
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        fields.push(`${key} = ?`)
        if (key === 'bracket_stage') {
          values.push(req.body.bracket_stage || null)
        } else {
          values.push(req.body[key])
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'bracket_stage')) {
      const validBracketStages = ['quarterfinal', 'semifinal', 'final', 'third_place']
      if (req.body.bracket_stage && !validBracketStages.includes(req.body.bracket_stage))
        return res.status(400).json({ message: 'Invalid bracket stage.' })
    }

    if (fields.length === 0) return res.status(400).json({ message: 'No valid fields to update.' })

    // Validate teams are different if both are provided
    if (req.body.home_team_id && req.body.away_team_id && req.body.home_team_id === req.body.away_team_id)
      return res.status(400).json({ message: 'Home and away teams must be different.' })

    // Validate scheduled_time is not in past if provided
    if (req.body.scheduled_time) {
      const scheduledDate = new Date(req.body.scheduled_time)
      if (Number.isNaN(scheduledDate.valueOf()) || scheduledDate < new Date())
        return res.status(400).json({ message: 'Cannot schedule games in the past.' })
    }

    values.push(req.params.id)
    const sql = `UPDATE games SET ${fields.join(', ')} WHERE game_id = ?`
    await db.query(sql, values)

    // Return updated game
    const [rows] = await db.query(`
      SELECT g.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      WHERE g.game_id = ?
    `, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Game not found.' })
    
    const io = req.app.get('io')
    io?.emit('scheduleUpdated', { action: 'updated', gameId: Number(req.params.id) })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update game.' })
  }
})

// DELETE game
router.delete('/games/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM player_stats WHERE game_id = ?', [req.params.id])

    try {
      await db.query('DELETE FROM game_logs WHERE game_id = ?', [req.params.id])
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        throw err
      }
    }

    await db.query('DELETE FROM games WHERE game_id = ?', [req.params.id])
    const io = req.app.get('io')
    io?.emit('scheduleUpdated', { action: 'deleted', gameId: Number(req.params.id) })
    res.json({ message: 'Game deleted.' })
  } catch (err) {
    console.error('[Admin] failed to delete game', err)
    res.status(500).json({ message: 'Failed to delete game.' })
  }
})

// ── ANNOUNCEMENTS MANAGEMENT ───────────────────────────────
router.get('/announcements', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.announcement_id, a.title, a.message, a.type, a.created_at,
             u.username AS author
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      ORDER BY a.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    console.error('[Admin] failed to fetch announcements', err)
    res.status(500).json({ message: 'Failed to fetch announcements.' })
  }
})

router.post('/announcements', async (req, res) => {
  const { title, message, type } = req.body
  if (!title || !message) return res.status(400).json({ message: 'Title and message are required.' })
  const validTypes = ['general', 'schedule', 'live', 'important']
  if (type && !validTypes.includes(type)) return res.status(400).json({ message: 'Invalid announcement type.' })

  try {
    const [result] = await db.query(
      'INSERT INTO announcements (title, message, type, author_id) VALUES (?, ?, ?, ?)',
      [title, message, type || 'general', req.user?.id || null]
    )

    try {
      const [users] = await db.query(
        "SELECT email, username FROM users WHERE status = 'approved' AND email IS NOT NULL AND email <> ''"
      )
      await Promise.allSettled(
        users.map((user) => sendAnnouncementEmail(user.email, title, message, user.username))
      )
    } catch (mailErr) {
      console.error('[Admin] bulk announcement email failed:', mailErr)
    }

    const io = req.app.get('io')
    io?.emit('announcementCreated', { announcement_id: result.insertId, title, message, type: type || 'general' })
    res.status(201).json({ message: 'Announcement created.', announcement_id: result.insertId })
  } catch (err) {
    console.error('[Admin] failed to create announcement', err)
    res.status(500).json({ message: 'Failed to create announcement.' })
  }
})

router.patch('/announcements/:id', async (req, res) => {
  try {
    const allowed = ['title', 'message', 'type']
    const fields = []
    const values = []
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        fields.push(`${key} = ?`)
        values.push(req.body[key])
      }
    }
    if (fields.length === 0) return res.status(400).json({ message: 'No valid fields to update.' })
    if (req.body.type && !['general', 'schedule', 'live', 'important'].includes(req.body.type)) {
      return res.status(400).json({ message: 'Invalid announcement type.' })
    }
    values.push(req.params.id)
    await db.query(`UPDATE announcements SET ${fields.join(', ')} WHERE announcement_id = ?`, values)
    const io = req.app.get('io')
    io?.emit('announcementUpdated', { announcement_id: Number(req.params.id) })
    res.json({ message: 'Announcement updated.' })
  } catch (err) {
    console.error('[Admin] failed to update announcement', err)
    res.status(500).json({ message: 'Failed to update announcement.' })
  }
})

router.delete('/announcements/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM announcements WHERE announcement_id = ?', [req.params.id])
    const io = req.app.get('io')
    io?.emit('announcementDeleted', { announcement_id: Number(req.params.id) })
    res.json({ message: 'Announcement deleted.' })
  } catch (err) {
    console.error('[Admin] failed to delete announcement', err)
    res.status(500).json({ message: 'Failed to delete announcement.' })
  }
})

// ── LIVE STATS UPDATES ──────────────────────────────────────
// POST /api/admin/player-stats — update or create player stats for a game
router.post('/player-stats', async (req, res) => {
  const { game_id, player_id, points, rebounds, assists, steals, blocks, fouls, turnovers } = req.body

  // Validate required fields
  if (!game_id || !player_id) {
    return res.status(400).json({ message: 'game_id and player_id are required.' })
  }

  // Validate at least one stat is being updated
  const stats = { points, rebounds, assists, steals, blocks, fouls, turnovers }
  const hasStats = Object.values(stats).some(v => v !== undefined && v !== null)
  if (!hasStats) {
    return res.status(400).json({ message: 'At least one stat must be provided.' })
  }

  for (const [statName, value] of Object.entries(stats)) {
    if (value === undefined || value === null) continue
    const numericValue = Number(value)
    if (!Number.isSafeInteger(numericValue) || numericValue < 0) {
      return res.status(400).json({ message: `${statName} must be a non-negative integer.` })
    }
    stats[statName] = numericValue
  }

  try {
    // Check if player_stats record exists
    const [existing] = await db.query(
      'SELECT stat_id FROM player_stats WHERE game_id = ? AND player_id = ?',
      [game_id, player_id]
    )

    let result
    if (existing.length > 0) {
      // Update existing record
      const updateFields = []
      const updateValues = []
      for (const [key, value] of Object.entries(stats)) {
        if (value !== undefined && value !== null) {
          updateFields.push(`${key} = ?`)
          updateValues.push(value)
        }
      }
      updateValues.push(game_id, player_id)
      const updateSql = `UPDATE player_stats SET ${updateFields.join(', ')} WHERE game_id = ? AND player_id = ?`
      await db.query(updateSql, updateValues)
      result = { message: 'Player stats updated.', game_id, player_id }
    } else {
      // Insert new record
      const insertFields = ['game_id', 'player_id']
      const insertValues = [game_id, player_id]
      const placeholders = ['?', '?']
      for (const [key, value] of Object.entries(stats)) {
        if (value !== undefined && value !== null) {
          insertFields.push(key)
          insertValues.push(value)
          placeholders.push('?')
        }
      }
      const insertSql = `INSERT INTO player_stats (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`
      await db.query(insertSql, insertValues)
      result = { message: 'Player stats created.', game_id, player_id }
    }

    const [[player]] = await db.query(
      'SELECT team_id FROM players WHERE player_id = ?',
      [player_id]
    )
    const [[game]] = await db.query(
      'SELECT home_team_id, away_team_id FROM games WHERE game_id = ?',
      [game_id]
    )
    const [[homeTotal]] = await db.query(
      'SELECT COALESCE(SUM(ps.points), 0) AS score FROM player_stats ps JOIN players p ON p.player_id = ps.player_id WHERE ps.game_id = ? AND p.team_id = ?',
      [game_id, game?.home_team_id]
    )
    const [[awayTotal]] = await db.query(
      'SELECT COALESCE(SUM(ps.points), 0) AS score FROM player_stats ps JOIN players p ON p.player_id = ps.player_id WHERE ps.game_id = ? AND p.team_id = ?',
      [game_id, game?.away_team_id]
    )
    await db.query(
      'UPDATE games SET home_score = ?, away_score = ? WHERE game_id = ?',
      [Number(homeTotal?.score || 0), Number(awayTotal?.score || 0), game_id]
    )

    const [updatedStats] = await db.query(
      'SELECT points, rebounds, assists, steals, blocks, fouls, turnovers FROM player_stats WHERE game_id = ? AND player_id = ?',
      [game_id, player_id]
    )
    const scorePayload = {
      gameId: Number(game_id),
      homeScore: Number(homeTotal?.score || 0),
      awayScore: Number(awayTotal?.score || 0)
    }

    // Broadcast both player stats and the recalculated game score.
    const io = req.app.get('io')
    io?.emit('playerStatsUpdated', {
      game_id: Number(game_id),
      player_id: Number(player_id),
      stats: updatedStats[0] || {}
    })
    io?.emit('scoreUpdate', scorePayload)
    io?.emit('gameScoreUpdated', { ...scorePayload, playerId: Number(player_id), stats: updatedStats[0] || {} })

    res.json(result)
  } catch (err) {
    console.error('[Admin] player-stats update failed', err)
    res.status(500).json({ message: 'Failed to update player stats.' })
  }
})

module.exports = router
