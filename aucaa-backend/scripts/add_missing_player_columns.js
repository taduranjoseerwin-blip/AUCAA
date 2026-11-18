const db = require('../config/db');
(async () => {
  try {
    await db.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS date_of_birth DATE");
    await db.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS height VARCHAR(20)");
    await db.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS weight VARCHAR(20)");
    await db.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS barangay VARCHAR(100)");
    await db.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS region VARCHAR(100)");
    await db.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS province VARCHAR(100)");
    await db.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS city VARCHAR(100)");
    console.log('ALTERS OK');
    process.exit(0);
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
})();
