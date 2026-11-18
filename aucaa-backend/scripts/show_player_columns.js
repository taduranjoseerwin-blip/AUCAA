const db = require('../config/db');
(async () => {
  try {
    const [rows] = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' ORDER BY ORDINAL_POSITION");
    console.log('COLUMNS:', rows.map(r => r.COLUMN_NAME).join(', '));
    process.exit(0);
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
})();
