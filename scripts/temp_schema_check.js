const db = require('./aucaa-backend/config/db');
(async () => {
  try {
    const [rows] = await db.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='players'");
    console.log(rows.map(r => r.COLUMN_NAME).join(','));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
  process.exit(0);
})();
