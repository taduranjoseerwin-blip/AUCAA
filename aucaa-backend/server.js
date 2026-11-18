require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const db = require('./config/db')
const adminRoutes = require('./routes/admin')
const path = require('path')

const app = express()
const httpServer = http.createServer(app)

async function ensureHierarchySchema() {
  const columns = [
    ['users', 'parent_user_id', 'INT NULL'],
    ['reg_codes', 'parent_user_id', 'INT NULL'],
  ]
  for (const [table, column, definition] of columns) {
    const [[exists]] = await db.query(
      'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [table, column]
    )
    if (Number(exists.count) === 0) {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }
}

// ── Socket.IO (for live score updates) ────────
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  socket.on('joinGame', (gameId) => {
    socket.join(`game_${gameId}`)
    console.log(`[Socket] ${socket.id} joined game_${gameId}`)
  })

  socket.on('leaveGame', (gameId) => {
    socket.leave(`game_${gameId}`)
  })

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  })
})

// Make io accessible in routes
app.set('io', io)

// ── Middleware ─────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[Server] JSON parse error:', err.message)
    return res.status(400).json({ message: 'Invalid JSON body.' })
  }
  next(err)
})
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ── Routes ─────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'))
app.use('/api/games',     require('./routes/games'))
app.use('/api/standings', require('./routes/standings'))
app.use('/api/players',   require('./routes/players'))
app.use('/api/teams',     require('./routes/teams'))
app.use('/api/uploads',   require('./routes/uploads'))
app.use('/api/announcements', require('./routes/announcements'))
app.use('/api/reports',   require('./routes/reports'))
app.use('/api/leagues',   require('./routes/leagues'))
app.use('/api/coach',     require('./routes/coach'))
app.use('/api/bracket',   require('./routes/bracket'))
app.use('/api/admin',     adminRoutes)

// ── Debug: view all users (remove in production) ──
app.get('/api/debug/users', async (req, res) => {
  const [rows] = await db.query('SELECT id, username, email, role, status, created_at FROM users')
  res.json(rows)
})

// ── Health check ───────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() })
})

// Public endpoint: get current highlight link (fans)
app.get('/api/highlight', (req, res) => {
  const fs = require('fs')
  const path = require('path')
  try {
    const file = path.join(__dirname, 'data/highlight.json')
    if (!fs.existsSync(file)) return res.json({ link: null, title: null })
    const obj = JSON.parse(fs.readFileSync(file, 'utf8'))
    res.json(obj)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch highlight.' })
  }
})

// DEBUG: trigger schedule update emit (unauthenticated) — remove in production
app.post('/api/debug/emit-schedule', (req, res) => {
  const io = app.get('io')
  const payload = req.body || { action: 'manual_test' }
  io?.emit('scheduleUpdated', payload)
  res.json({ message: 'Emitted scheduleUpdated', payload })
})

// DEBUG: unauthenticated save highlight (for local testing)
app.post('/api/debug/save-highlight', (req, res) => {
  const fs = require('fs')
  const path = require('path')
  try {
    const dir = path.join(__dirname, 'data')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'highlight.json')
    fs.writeFileSync(file, JSON.stringify(req.body || {}))
    const io = app.get('io')
    io?.emit('highlightUpdated', req.body || {})
    res.json({ message: 'Saved highlight (debug).' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to save highlight.' })
  }
})
// ── Start server ───────────────────────────────
const PORT = process.env.PORT || 5000

db.query('SELECT 1')
  .then(() => ensureHierarchySchema())
  .then(() => {
    console.log('✅ MySQL connected!')
    httpServer.listen(PORT, () => {
      console.log('─────────────────────────────────────')
      console.log(`  AUCAA Backend running on port ${PORT}`)
      console.log(`  http://localhost:${PORT}`)
      console.log('─────────────────────────────────────')
      console.log('  Default admin login:')
      console.log('  Username: admin')
      console.log('  Password: admin123')
      console.log('─────────────────────────────────────')
      console.log('  Debug users:')
      console.log(`  http://localhost:${PORT}/api/debug/users`)
      console.log('─────────────────────────────────────')
    })
  })
  .catch((err) => {
    console.error('❌ MySQL connection failed:', err.message)
    console.error('   Check your .env file — DB_PASSWORD correct ba?')
    process.exit(1)
  })
