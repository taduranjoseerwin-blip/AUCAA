const db = require('../config/db');
(async () => {
  try {
    const needed = [
      { name: 'date_of_birth', sql: "ALTER TABLE players ADD COLUMN date_of_birth DATE" },
      { name: 'height', sql: "ALTER TABLE players ADD COLUMN height VARCHAR(20)" },
      { name: 'weight', sql: "ALTER TABLE players ADD COLUMN weight VARCHAR(20)" },
      { name: 'barangay', sql: "ALTER TABLE players ADD COLUMN barangay VARCHAR(100)" },
      { name: 'region', sql: "ALTER TABLE players ADD COLUMN region VARCHAR(100)" },
      { name: 'province', sql: "ALTER TABLE players ADD COLUMN province VARCHAR(100)" },
      { name: 'city', sql: "ALTER TABLE players ADD COLUMN city VARCHAR(100)" }
    ];
    const [cols] = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players'");
    const existing = new Set(cols.map(r => r.COLUMN_NAME));
    for (const n of needed) {
      if (!existing.has(n.name)) {
        console.log('Adding', n.name);
        await db.query(n.sql);
        console.log('Added', n.name);
      } else {
        console.log('Exists', n.name);
      }
    }
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
})();
