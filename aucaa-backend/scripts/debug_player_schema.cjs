const db = require('./config/db');
(async () => {
  try {
    const [dbName] = await db.query('SELECT DATABASE() AS db');
    console.log('Database:', dbName[0].db);
    const [cols] = await db.query("SHOW COLUMNS FROM players LIKE 'region'");
    console.log('region column:', cols.length > 0 ? cols[0] : 'missing');
    const [prov] = await db.query("SHOW COLUMNS FROM players LIKE 'province'");
    console.log('province column:', prov.length > 0 ? prov[0] : 'missing');
    const [city] = await db.query("SHOW COLUMNS FROM players LIKE 'city'");
    console.log('city column:', city.length > 0 ? city[0] : 'missing');
    const [row] = await db.query('SELECT region, province, city FROM players LIMIT 1');
    console.log('sample row:', row.length > 0 ? row[0] : 'no rows');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
  process.exit(0);
})();
