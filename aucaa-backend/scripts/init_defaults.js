const db = require('../config/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function reinitializeDefaults() {
  try {
    const connection = await db.getConnection();
    
    // Insert default admin user
    await connection.execute(
      'INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin@aucaa.com', '$2a$10$Bz1PypsmTSN7knDlLgVl7eoSPEhrtBVsE1DxN4GYZZu6wB/1gZa5O', 'admin', 'active']
    );
    console.log('✓ Created admin user (admin@aucaa.com / admin123)');
    
    // Insert registration codes
    const regCodes = [
      ['AUCAA-SEN-2026', 'player'],
      ['AUCAA-PLAYER-2026', 'player'],
      ['AUCAA-MANAGER-2026', 'league_manager'],
      ['AUCAA-2026', 'fan']
    ];
    
    for (const [code, role] of regCodes) {
      await connection.execute(
        'INSERT INTO reg_codes (code, role) VALUES (?, ?)',
        [code, role]
      );
      console.log(`✓ Created registration code: ${code} (${role})`);
    }
    
    connection.release();
    console.log('\n✅ Default data reinitialized successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error reinitializing defaults:', err.message);
    process.exit(1);
  }
}

reinitializeDefaults();
