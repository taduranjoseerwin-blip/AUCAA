const jwt = require('jsonwebtoken')
const db = require('../config/db')

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) return res.status(401).json({ message: 'No token provided.' })

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }

  if (!decoded.session_id) {
    return res.status(401).json({ message: 'Session is no longer active. Please log in again.' })
  }

  try {
    const [sessions] = await db.query(
      'SELECT id FROM user_sessions WHERE session_id = ? AND user_id = ? AND expires_at > NOW() LIMIT 1',
      [decoded.session_id, decoded.id]
    )
    if (sessions.length === 0) {
      return res.status(401).json({ message: 'Session is no longer active. Please log in again.' })
    }

    req.user = decoded
    next()
  } catch (err) {
    console.error('Session validation error:', err)
    return res.status(500).json({ message: 'Unable to validate session.' })
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'league_manager')
    return res.status(403).json({ message: 'Access denied.' })
  next()
}

function rolesOnly(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Access denied for this role.' })
    }
    next()
  }
}

module.exports = { authMiddleware, adminOnly, rolesOnly }
