const db = require('../config/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function clearAllData() {
  try {
    const connection = await db.getConnection();
    
    // Disable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // Delete data from all tables (keeping schema)
    const tables = [
      'player_stats',
      'bracket_audit',
      'players',
      'bracket_participants',
      'brackets',
      'announcements',
      'uploads',
      'games',
      'teams',
      'reg_codes',
      'users'
    ];
    
    for (const table of tables) {
      try {
        await connection.execute(`TRUNCATE TABLE ${table}`);
        console.log(`✓ Cleared ${table}`);
      } catch (err) {
        console.log(`⊘ Skipped ${table} (${err.code})`);
      }
    }
    
    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    connection.release();
    console.log('\n✅ Database cleared successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing database:', err.message);
    process.exit(1);
  }
}

clearAllData();
