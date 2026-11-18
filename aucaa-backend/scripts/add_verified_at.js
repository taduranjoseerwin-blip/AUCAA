const db = require('../config/db');

(async () => {
  try {
    const [cols] = await db.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='players' AND column_name='verified_at'");
    if (cols.length === 0) {
      await db.query("ALTER TABLE players ADD COLUMN verified_at TIMESTAMP NULL DEFAULT NULL");
      console.log('added verified_at');
    } else {
      console.log('verified_at already exists');
    }
    const [check] = await db.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='players' AND column_name IN ('verified_at','created_at') ORDER BY COLUMN_NAME");
    console.log(JSON.stringify(check, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
