const db = require('./config/db')

async function fixEnum() {
  try {
    await db.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin', 'league_manager', 'player', 'coach', 'fan') DEFAULT 'fan'
    `)
    console.log('✅ Users table role ENUM updated successfully!')
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    process.exit(0)
  }
}

fixEnum()
