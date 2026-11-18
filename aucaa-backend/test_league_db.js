require('dotenv').config();
const db = require('./config/db');

(async () => {
  try {
    const [games] = await db.query(`
      SELECT g.*,
        l.name AS league_name,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name
      FROM games g
      LEFT JOIN leagues l ON g.league_id = l.league_id
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams at ON g.away_team_id = at.team_id
      ORDER BY g.scheduled_time DESC
      LIMIT 1
    `);
    console.log('Game with league_name:');
    console.log(JSON.stringify(games[0], null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
})();
