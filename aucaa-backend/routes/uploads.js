const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../config/db')
// Import adminOnly middleware
const { authMiddleware, adminOnly } = require('../middleware/auth')

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/players')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for player pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const playerId = req.params.playerId
    const ext = path.extname(file.originalname)
    cb(null, `player_${playerId}_${Date.now()}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)
  
  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'))
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
})

// POST /api/uploads/player/:playerId — upload player picture (admin only)
router.post('/player/:playerId', authMiddleware, adminOnly, upload.single('picture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const { playerId } = req.params
    const filePath = `players/${req.file.filename}`

    // Get old picture to delete if exists
    const [oldPlayer] = await db.query('SELECT profile_picture FROM players WHERE player_id = ?', [playerId])
    if (oldPlayer.length > 0 && oldPlayer[0].profile_picture) {
      try {
        fs.unlinkSync(path.join(__dirname, '../uploads/', oldPlayer[0].profile_picture))
      } catch (err) {
        console.log('Could not delete old file:', err)
      }
    }

    // Update player with new picture path
    await db.query('UPDATE players SET profile_picture = ? WHERE player_id = ?', [filePath, playerId])

    res.json({ 
      message: 'Picture uploaded successfully',
      picture_url: `/uploads/${filePath}`,
      filename: req.file.filename
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to upload picture' })
  }
})

// DELETE /api/uploads/player/:playerId — delete player picture (admin only)
router.delete('/player/:playerId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { playerId } = req.params
    
    const [player] = await db.query('SELECT profile_picture FROM players WHERE player_id = ?', [playerId])
    
    if (player.length === 0) {
      return res.status(404).json({ message: 'Player not found' })
    }

    if (player[0].profile_picture) {
      try {
        fs.unlinkSync(path.join(__dirname, '../', player[0].profile_picture))
      } catch (err) {
        console.log('Could not delete file:', err)
      }

      await db.query('UPDATE players SET profile_picture = NULL WHERE player_id = ?', [playerId])
    }

    res.json({ message: 'Picture deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to delete picture' })
  }
})

module.exports = router
