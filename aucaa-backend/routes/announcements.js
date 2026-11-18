const router = require('express').Router()
const db = require('../config/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')
const { sendAnnouncementEmail } = require('../config/mailer')

const validTypes = ['general', 'schedule', 'live', 'important']

// Public: list announcements
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.*, u.username AS author
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      ORDER BY a.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch announcements.' })
  }
})

// Admin: create announcement
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { title, message, type = 'general' } = req.body
  if (!title || !message) return res.status(400).json({ message: 'Title and message are required.' })
  if (!validTypes.includes(type)) return res.status(400).json({ message: 'Invalid announcement type.' })

  try {
    const [result] = await db.query(
      'INSERT INTO announcements (title, message, type, author_id) VALUES (?, ?, ?, ?)',
      [title.trim(), message.trim(), type, req.user.id]
    )
    const [rows] = await db.query(
      `SELECT a.*, u.username AS author
       FROM announcements a
       LEFT JOIN users u ON a.author_id = u.id
       WHERE a.announcement_id = ?`,
      [result.insertId]
    )
    const announcement = rows[0]

    try {
      const [users] = await db.query(
        "SELECT email, username FROM users WHERE status = 'approved' AND email IS NOT NULL AND email <> ''"
      )
      await Promise.allSettled(
        users.map((user) => sendAnnouncementEmail(user.email, announcement.title, announcement.message, user.username))
      )
    } catch (mailErr) {
      console.error('[Announcements] bulk email notification failed:', mailErr)
    }

    const io = req.app.get('io')
    io?.emit('announcementCreated', announcement)
    res.status(201).json(announcement)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to create announcement.' })
  }
})

// Admin: update announcement
router.patch('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { title, message, type } = req.body
  if (!title && !message && !type) return res.status(400).json({ message: 'Nothing to update.' })
  if (type && !validTypes.includes(type)) return res.status(400).json({ message: 'Invalid announcement type.' })

  const fields = []
  const values = []
  if (title) {
    fields.push('title = ?')
    values.push(title.trim())
  }
  if (message) {
    fields.push('message = ?')
    values.push(message.trim())
  }
  if (type) {
    fields.push('type = ?')
    values.push(type)
  }
  values.push(req.params.id)

  try {
    const [result] = await db.query(`UPDATE announcements SET ${fields.join(', ')} WHERE announcement_id = ?`, values)
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Announcement not found.' })

    const [rows] = await db.query(
      `SELECT a.*, u.username AS author
       FROM announcements a
       LEFT JOIN users u ON a.author_id = u.id
       WHERE a.announcement_id = ?`,
      [req.params.id]
    )
    const announcement = rows[0]
    const io = req.app.get('io')
    io?.emit('announcementUpdated', announcement)
    res.json(announcement)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update announcement.' })
  }
})

// Delete announcement: allowed for admin, league manager, player, and fan
router.delete('/:id', authMiddleware, async (req, res) => {
  const allowedRoles = ['admin', 'league_manager', 'player', 'fan']
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Access denied.' })
  }

  try {
    const [result] = await db.query('DELETE FROM announcements WHERE announcement_id = ?', [req.params.id])
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Announcement not found.' })
    const io = req.app.get('io')
    io?.emit('announcementDeleted', { announcement_id: Number(req.params.id) })
    res.json({ message: 'Announcement deleted.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to delete announcement.' })
  }
})

module.exports = router
