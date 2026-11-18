const crypto = require('crypto')
const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../config/db')
const { authMiddleware } = require('../middleware/auth')
const { sendPasswordResetOtp, sendEmailVerification } = require('../config/mailer')

const RESET_TOKEN_TTL_MINUTES = 30
const OTP_TTL_MINUTES = 10
const verificationResendAttempts = new Map()
let emailVerificationSchemaPromise
let sessionCleanupTimer
const PASSWORD_POLICY_MESSAGE = 'Password is too weak. It must be at least 8 characters and include an uppercase letter and a unique special character (e.g., !@#$%^&*()-+).'
const PASSWORD_RULES = [
  { label: 'at least 8 characters', test: (value) => String(value || '').length >= 8 },
  { label: 'an uppercase letter', test: (value) => /[A-Z]/.test(String(value || '')) },
  { label: 'a lowercase letter', test: (value) => /[a-z]/.test(String(value || '')) },
  { label: 'a number', test: (value) => /\d/.test(String(value || '')) },
  { label: 'a special character', test: (value) => /[^A-Za-z0-9]/.test(String(value || '')) }
]

function passwordMeetsRequirements(password) {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}

function getDateOfBirthError(dateOfBirth) {
  if (!dateOfBirth) return 'Date of birth is required.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth))) return 'Date of birth must be a valid date.'

  const selectedDate = new Date(`${dateOfBirth}T00:00:00`)
  const [year, month, day] = String(dateOfBirth).split('-').map(Number)
  if (
    selectedDate.getFullYear() !== year ||
    selectedDate.getMonth() + 1 !== month ||
    selectedDate.getDate() !== day
  ) return 'Date of birth must be a valid date.'
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (Number.isNaN(selectedDate.getTime())) return 'Date of birth must be a valid date.'
  if (selectedDate > today) return 'Date of birth cannot be in the future.'

  return null
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function ensureUserSessionTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      session_id VARCHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_sessions_user_id (user_id),
      CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  if (!sessionCleanupTimer) {
    sessionCleanupTimer = setInterval(() => {
      db.query('DELETE FROM user_sessions WHERE expires_at <= NOW()')
        .catch((error) => console.error('Expired session cleanup failed:', error))
    }, 60 * 60 * 1000)
    sessionCleanupTimer.unref?.()
  }
}

function ensureEmailVerificationSchema() {
  if (emailVerificationSchemaPromise) return emailVerificationSchemaPromise
  emailVerificationSchemaPromise = (async () => {
    await db.query(`ALTER TABLE users MODIFY status ENUM('active', 'pending', 'suspended', 'approved', 'rejected') NOT NULL DEFAULT 'pending'`)
    await db.query(`UPDATE users SET status = 'approved' WHERE status = 'active'`)
    await db.query(`UPDATE users SET status = 'rejected' WHERE status = 'suspended'`)
    await db.query(`ALTER TABLE users MODIFY status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'`)
    const columns = [
      ['email_verified_at', 'TIMESTAMP NULL DEFAULT NULL'],
      ['email_verification_token_hash', 'VARCHAR(128) NULL'],
      ['email_verification_expires_at', 'DATETIME NULL']
    ]
    for (const [name, definition] of columns) {
      const [[exists]] = await db.query(
        'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = \'users\' AND column_name = ?',
        [name]
      )
      if (Number(exists.count) === 0) await db.query(`ALTER TABLE users ADD COLUMN ${name} ${definition}`)
    }
    await db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at) WHERE email_verified_at IS NULL AND email_verification_token_hash IS NULL')
  })().catch(error => {
    emailVerificationSchemaPromise = null
    throw error
  })
  return emailVerificationSchemaPromise
}

async function createEmailVerification(userId, email) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  await db.query(
    'UPDATE users SET email_verification_token_hash = ?, email_verification_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR), email_verified_at = NULL WHERE id = ?',
    [tokenHash, userId]
  )
  await sendEmailVerification(email, token)
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, reg_code = '', role: selectedRole, full_name, jersey_number, position, date_of_birth, height, weight, region, province, city, barangay, barangay_lat, barangay_lng, barangay_place_id } = req.body

  if (!username || !email || !password || !selectedRole)
    return res.status(400).json({ message: 'All fields are required.' })

  if (!passwordMeetsRequirements(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE })
  }

  let connection
  try {
    await ensureEmailVerificationSchema()
    let role = selectedRole
    let registrationCode = null
    if (!['player', 'coach', 'league_manager'].includes(selectedRole)) {
      return res.status(400).json({ message: 'Fan registration is not available. Select an authorized role.' })
    }

    if (selectedRole === 'player' || selectedRole === 'coach' || selectedRole === 'league_manager') {
      if (!reg_code)
        return res.status(400).json({ message: `Registration code is required for ${selectedRole} registration.` })

      const [codes] = await db.query('SELECT * FROM reg_codes WHERE code = ? AND used = 0', [reg_code])
      if (codes.length === 0)
        return res.status(400).json({ message: 'Invalid or already used registration code.' })

      registrationCode = codes[0]
      role = registrationCode.role
      if (selectedRole !== role)
        return res.status(400).json({ message: 'This registration code is not valid for the selected role.' })
    }

    if (role === 'player' && !full_name)
      return res.status(400).json({ message: 'Full name is required for player registration.' })

    if (role === 'player') {
      const dobError = getDateOfBirthError(date_of_birth)
      if (dobError) {
        return res.status(400).json({ message: dobError })
      }
      if (!/^\d+$/.test(String(height || '').trim()) || Number(height) < 100 || Number(height) > 250) {
        return res.status(400).json({ message: 'Height must be a whole number from 100 to 250 cm.' })
      }
      if (!/^\d+$/.test(String(weight || '').trim()) || Number(weight) < 30 || Number(weight) > 200) {
        return res.status(400).json({ message: 'Weight must be a whole number from 30 to 200 kg.' })
      }
      if (!/^\d+$/.test(String(jersey_number || '').trim()) || Number(jersey_number) < 0 || Number(jersey_number) > 99) {
        return res.status(400).json({ message: 'Jersey number must be a whole number from 0 to 99.' })
      }
    }

    connection = await db.getConnection()
    await connection.beginTransaction()

    const [existing] = await connection.query('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1', [email, username])
    if (existing.length > 0) {
      await connection.rollback()
      connection.release()
      connection = null
      return res.status(400).json({ message: 'Email or username already registered.' })
    }

    const hashed = await bcrypt.hash(password, 10)

    const userStatus = 'pending'

    const parentUserId = role === 'coach' || role === 'player' ? (registrationCode?.parent_user_id || null) : null

    const [userResult] = await connection.query(
      'INSERT INTO users (username, email, password, role, parent_user_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashed, role, parentUserId, userStatus]
    )

    if (role === 'player') {
      await connection.query(
        'INSERT INTO players (name, user_id, verification_status, jersey_number, position, date_of_birth, height, weight, region, province, city, barangay, barangay_lat, barangay_lng, barangay_place_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [full_name, userResult.insertId, 'pending', jersey_number || null, position || null, date_of_birth || null, height || null, weight || null, region || null, province || null, city || null, barangay || null, barangay_lat || null, barangay_lng || null, barangay_place_id || null]
      )
    }

    if ((selectedRole === 'coach' || selectedRole === 'league_manager' || selectedRole === 'player') && reg_code) {
      const [codeResult] = await connection.query(
        'UPDATE reg_codes SET used = 1 WHERE code = ? AND used = 0 AND role = ? AND id = ?',
        [reg_code, role, registrationCode.id]
      )
      if (codeResult.affectedRows !== 1) throw new Error('Registration code could not be used.')
    }

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await connection.query(
      'UPDATE users SET email_verification_token_hash = ?, email_verification_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR), email_verified_at = NULL WHERE id = ?',
      [tokenHash, userResult.insertId]
    )
    await connection.commit()
    connection.release()
    connection = null

    try {
      await sendEmailVerification(email, token)
    } catch (emailError) {
      console.error('Email verification send failed after registration:', emailError.message || emailError)
    }
    req.app.get('io')?.emit('verificationUpdated', {
      action: 'registered',
      verification_type: role === 'player' ? 'player' : 'account',
      user_id: userResult.insertId,
    })

    const message = 'Registration successful! Check your email and verify your account before logging in.'
    return res.status(201).json({ message })
  } catch (err) {
    if (connection) {
      try { await connection.rollback() } catch (_) {}
      connection.release()
    }
    console.error('❌ Registration error:', err.message || err)
    console.error('Full error:', err)
    return res.status(500).json({ message: 'Server error during registration.' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password, email } = req.body
  const loginName = String(username || email || '').trim()

  if (!loginName || !password)
    return res.status(400).json({ message: 'Email/Username and password are required.' })

  try {
    await ensureEmailVerificationSchema()
    await ensureUserSessionTable()
    await db.query('DELETE FROM user_sessions WHERE expires_at <= NOW()')
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
      [loginName, loginName]
    )
    if (users.length === 0)
      return res.status(401).json({ message: 'Invalid username or password.' })

    const user = users[0]

    if (user.status === 'pending')
      return res.status(403).json({
        message: user.role === 'player'
          ? "Your account is waiting for your coach's approval."
          : 'Your account is waiting for approval.'
      })

    if (user.status === 'rejected')
      return res.status(403).json({ message: 'Your account has been rejected.' })

    if (!user.email_verified_at)
      return res.status(403).json({ message: 'Please verify your email first.' })

    const match = await bcrypt.compare(password, user.password)
    if (!match)
      return res.status(401).json({ message: 'Invalid username or password.' })

    const sessionId = crypto.randomUUID()
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, session_id: sessionId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await db.query(
      'INSERT INTO user_sessions (user_id, session_id, expires_at) VALUES (?, ?, ?)',
      [user.id, sessionId, expiresAt]
    )

    return res.json({
      token,
      session_id: sessionId,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Server error during login.' })
  }
})

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()

  if (!email) return res.status(400).json({ message: 'Please enter your email first.' })

  try {
    await ensureEmailVerificationSchema()
    const [users] = await db.query(
      '      SELECT id, email, role, status, email_verified_at FROM users WHERE email = ?',
      [email]
    )

    if (users.length === 0) return res.status(404).json({ message: 'Email not found.' })

    const user = users[0]
    const lastAttempt = verificationResendAttempts.get(email) || 0
    const secondsSinceLastAttempt = (Date.now() - lastAttempt) / 1000
    if (secondsSinceLastAttempt < 60) {
      return res.status(429).json({ message: 'Please wait 60 seconds before requesting another verification email.' })
    }

    verificationResendAttempts.set(email, Date.now())

    if (user.email_verified_at) {
      return res.json({
        message: user.status === 'pending'
          ? (user.role === 'player'
              ? "Your email is already verified. Please wait for your coach's approval."
              : 'Your email is already verified. Please wait for approval.')
          : 'Your email is already verified.'
      })
    }

    await createEmailVerification(user.id, user.email)

    return res.json({ message: 'A new verification email has been sent. Please check your inbox.' })
  } catch (err) {
    console.error('❌ Resend verification error:', err)
    return res.status(500).json({ message: 'Unable to resend verification email.' })
  }
})

// POST /api/auth/check-username
router.post('/check-username', async (req, res) => {
  const username = String(req.body?.username || '').trim()

  if (!username) return res.status(400).json({ message: 'Please enter the registered username first.' })

  try {
    const [users] = await db.query('SELECT id FROM users WHERE username = ?', [username])
    if (users.length === 0) {
      return res.status(404).json({ message: 'Username does not exist. Please enter the correct registered username.' })
    }

    return res.json({ message: 'Username found.' })
  } catch (err) {
    console.error('❌ Username check error:', err)
    return res.status(500).json({ message: 'Unable to check username.' })
  }
})

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM user_sessions WHERE session_id = ? AND user_id = ?',
      [req.user.session_id, req.user.id]
    )
    return res.json({ message: 'Logged out successfully.' })
  } catch (err) {
    console.error('Logout error:', err)
    return res.status(500).json({ message: 'Failed to end session.' })
  }
})

// GET /api/auth/verify-email?token=...
router.get('/verify-email', async (req, res) => {
  const token = String(req.query.token || '')
  if (!token) return res.status(400).json({ message: 'Verification token is required.' })

  try {
    await ensureEmailVerificationSchema()
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const [users] = await db.query(
      'SELECT id, role, status, email_verified_at, email_verification_expires_at FROM users WHERE email_verification_token_hash = ?',
      [tokenHash]
    )
    if (users.length === 0) return res.status(400).json({ message: 'Invalid verification link.' })
    if (!users[0].email_verification_expires_at || new Date(users[0].email_verification_expires_at) <= new Date()) {
      return res.status(400).json({ message: 'Your verification link has expired.' })
    }

    if (!users[0].email_verified_at) {
      await db.query('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [users[0].id])
    }

    if (users[0].status === 'pending') {
      return res.json({
        message: users[0].role === 'player'
          ? "Your email has been verified. Please wait for your coach's approval."
          : 'Your email has been verified. Please wait for approval.',
        awaiting_approval: true
      })
    }

    res.json({ message: 'Your email has been verified.', awaiting_approval: false })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to verify email.' })
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const rawUsername = req.body?.username
  const rawEmail = req.body?.email

  if (!rawUsername || !String(rawUsername).trim()) {
    return res.status(400).json({ message: 'Username is required before sending a verification code.' })
  }

  if (!rawEmail || !String(rawEmail).trim()) {
    return res.status(400).json({ message: 'Email is required.' })
  }

  const username = String(rawUsername).trim()
  const email = String(rawEmail).trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format.' })
  }

  try {
    const [usernameUsers] = await db.query('SELECT id, email, username FROM users WHERE username = ?', [username])

    if (usernameUsers.length === 0) {
      return res.status(404).json({ message: 'Username does not exist. Please enter the correct registered username.' })
    }

    const user = usernameUsers[0]
    if (String(user.email).trim().toLowerCase() !== email) {
      return res.status(404).json({ message: 'Please enter the correct email for this username.' })
    }
    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

    await db.query('DELETE FROM password_resets WHERE user_id = ?', [user.id])
    await db.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, otpHash, expiresAt]
    )

    await sendPasswordResetOtp(user.email, otp)

    return res.json({ message: 'A 6-digit verification code has been sent to your email.' })
  } catch (err) {
    console.error('❌ Forgot password error:', err)

    if (err && (err.code === 'EAUTH' || /Application-specific password required|Invalid login/i.test(err.message || ''))) {
      return res.status(500).json({
        message: 'Email delivery failed. Gmail requires a valid App Password in the backend .env file before the verification code can be sent.'
      })
    }

    return res.status(500).json({ message: 'Unable to process password reset request.' })
  }
})

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const { email, otp, username } = req.body

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required.' })
  }

  if (!username || !String(username).trim()) {
    return res.status(400).json({ message: 'Username is required before verification.' })
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedUsername = String(username).trim()
    const [userRows] = await db.query('SELECT id FROM users WHERE email = ? AND username = ?', [normalizedEmail, normalizedUsername])

    if (userRows.length === 0) {
      return res.status(400).json({ message: 'This OTP is invalid or has expired.' })
    }

    const [entries] = await db.query(
      'SELECT * FROM password_resets WHERE user_id = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [userRows[0].id]
    )

    if (entries.length === 0) {
      return res.status(400).json({ message: 'This OTP is invalid or has expired.' })
    }

    const valid = await bcrypt.compare(String(otp), entries[0].token_hash)
    if (!valid) {
      return res.status(400).json({ message: 'This OTP is invalid or has expired.' })
    }

    return res.json({ message: 'OTP verified successfully.' })
  } catch (err) {
    console.error('❌ Verify OTP error:', err)
    return res.status(500).json({ message: 'Unable to verify OTP.' })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, otp, token, username, password } = req.body

  if (!password) {
    return res.status(400).json({ message: 'New password is required.' })
  }

  if (!username || !String(username).trim()) {
    return res.status(400).json({ message: 'Username is required before resetting your password.' })
  }

  if (!passwordMeetsRequirements(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE })
  }

  try {
    let resetEntry = null
    let userId = null

    if (token) {
      const [passwordResets] = await db.query(
        'SELECT * FROM password_resets WHERE used = 0 AND expires_at > NOW() ORDER BY created_at DESC'
      )

      for (const entry of passwordResets) {
        const valid = await bcrypt.compare(String(token), entry.token_hash)
        if (valid) {
          resetEntry = entry
          userId = entry.user_id
          break
        }
      }
    } else if (email && otp) {
      const normalizedEmail = String(email).trim().toLowerCase()
      const normalizedUsername = String(username).trim()
      const [userRows] = await db.query('SELECT id FROM users WHERE email = ? AND username = ?', [normalizedEmail, normalizedUsername])

      if (userRows.length === 0) {
        return res.status(400).json({ message: 'This reset request is invalid or has expired.' })
      }

      userId = userRows[0].id
      const [entries] = await db.query(
        'SELECT * FROM password_resets WHERE user_id = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
        [userId]
      )

      if (entries.length === 0) {
        return res.status(400).json({ message: 'This reset request is invalid or has expired.' })
      }

      const valid = await bcrypt.compare(String(otp), entries[0].token_hash)
      if (!valid) {
        return res.status(400).json({ message: 'This OTP is invalid or has expired.' })
      }

      resetEntry = entries[0]
    }

    if (!resetEntry || !userId) {
      return res.status(400).json({ message: 'This reset request is invalid or has expired.' })
    }

    const [userRows] = await db.query('SELECT id FROM users WHERE id = ?', [userId])
    if (userRows.length === 0) {
      return res.status(400).json({ message: 'This reset request is invalid or has expired.' })
    }

    const hashed = await bcrypt.hash(password, 10)

    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId])
    await db.query('UPDATE password_resets SET used = 1, used_at = NOW() WHERE id = ?', [resetEntry.id])

    return res.json({ message: 'Your password has been reset successfully.' })
  } catch (err) {
    console.error('❌ Reset password error:', err)
    return res.status(500).json({ message: 'Unable to reset password.' })
  }
})

// Account settings — owned by the authenticated user
router.get('/account', authMiddleware, async (req, res) => {
  try {
    const [userRows] = await db.query('SELECT id, username, email, role FROM users WHERE id = ?', [req.user.id])
    if (!userRows.length) return res.status(404).json({ message: 'Account not found.' })

    const [playerRows] = await db.query(`
      SELECT p.player_id, p.name, p.student_id, p.date_of_birth, p.height, p.weight,
             p.region, p.province, p.city, p.barangay, p.jersey_number, p.position,
             p.team_id, t.team_name
      FROM players p
      LEFT JOIN teams t ON t.team_id = p.team_id
      WHERE p.user_id = ? LIMIT 1
    `, [req.user.id])

    const account = userRows[0]
    const player = playerRows[0] || {}
    res.json({
      email: account.email,
      username: account.username,
      role: account.role,
      name: player.name || '',
      student_id: player.student_id || '',
      date_of_birth: player.date_of_birth || '',
      height: player.height || '',
      weight: player.weight || '',
      region: player.region || '',
      province: player.province || '',
      city: player.city || '',
      barangay: player.barangay || '',
      team_id: player.team_id || '',
      team_name: player.team_name || '',
      jersey_number: player.jersey_number || '',
      position: player.position || '',
      player_id: player.player_id || null
    })
  } catch (err) {
    console.error('Account settings load failed:', err)
    res.status(500).json({ message: 'Failed to load account settings.' })
  }
})

router.patch('/account/profile', authMiddleware, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const username = String(req.body?.username || '').trim()

    if (!email) return res.status(400).json({ message: 'Email is required.' })
    if (!username) return res.status(400).json({ message: 'Username is required.' })

    const [emailConflict] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, req.user.id])
    if (emailConflict.length) return res.status(409).json({ message: 'Email is already used by another account.' })

    const [usernameConflict] = await db.query('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1', [username, req.user.id])
    if (usernameConflict.length) return res.status(409).json({ message: 'Username is already used by another account.' })

    await db.query('UPDATE users SET email = ?, username = ? WHERE id = ?', [email, username, req.user.id])

    const editablePlayerFields = ['name', 'student_id', 'date_of_birth', 'height', 'weight', 'region', 'province', 'city', 'barangay', 'jersey_number', 'position', 'team_id']
    const fields = []
    const values = []
    for (const key of editablePlayerFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        fields.push(`${key} = ?`)
        let value = req.body[key] === '' ? null : req.body[key]
        if (key === 'team_id' && value !== null) value = Number(value)
        if (key === 'jersey_number' && value !== null) value = Number(value)
        values.push(value)
      }
    }

    if (fields.length) {
      values.push(req.user.id)
      await db.query(`UPDATE players SET ${fields.join(', ')} WHERE user_id = ?`, values)
    }

    const profile = { email, username, ...Object.fromEntries(editablePlayerFields.map((key) => [key, req.body[key] ?? null])) }
    res.json({ message: 'Profile updated successfully.', profile })
  } catch (err) {
    console.error('Account profile update failed:', err)
    res.status(500).json({ message: 'Failed to update profile information.' })
  }
})

router.post('/account/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {}

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All password fields are required.' })
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New password and confirmation password do not match.' })
  }
  if (!passwordMeetsRequirements(newPassword)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE })
  }

  try {
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id])
    if (!rows.length) return res.status(404).json({ message: 'Account not found.' })

    const matches = await bcrypt.compare(currentPassword, rows[0].password)
    if (!matches) return res.status(400).json({ message: 'Current password is incorrect.' })

    const sameAsCurrent = await bcrypt.compare(newPassword, rows[0].password)
    if (sameAsCurrent) return res.status(400).json({ message: 'New password must be different from the current password.' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id])
    res.json({ message: 'Password changed successfully.' })
  } catch (err) {
    console.error('Password change failed:', err)
    res.status(500).json({ message: 'Failed to change password.' })
  }
})

module.exports = router
