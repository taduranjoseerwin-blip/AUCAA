const db = require('../config/db');
(async () => {
  try {
    const [version] = await db.query('SELECT VERSION() AS version');
    console.log('MySQL version:', version[0].version);
    const sql = `SELECT
      p.player_id, p.name, p.jersey_number, p.position, p.profile_picture,
      p.student_id, p.date_of_birth, p.height, p.weight, p.region, p.province, p.city, p.barangay,
      p.barangay_lat, p.barangay_lng, p.barangay_place_id,
      p.verification_status, p.verified_at, p.created_at,
      t.team_id, t.team_name, t.league_id,
      ROUND(AVG(ps.points),   1) AS ppg,
      ROUND(AVG(ps.rebounds), 1) AS rpg,
      ROUND(AVG(ps.assists),  1) AS apg,
      ROUND(AVG(ps.steals),   1) AS spg,
      ROUND(AVG(ps.blocks),   1) AS bpg,
      ROUND(AVG(ps.fouls),    1) AS fpg
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.team_id
    LEFT JOIN player_stats ps ON ps.player_id = p.player_id
    WHERE p.verification_status = 'verified'
    GROUP BY p.player_id, p.name, p.jersey_number, p.position, p.profile_picture, p.student_id, p.date_of_birth, p.height, p.weight, p.region, p.province, p.city, p.barangay, p.barangay_lat, p.barangay_lng, p.barangay_place_id, p.verification_status, p.verified_at, p.created_at, t.team_id, t.team_name, t.league_id
    ORDER BY p.name
    LIMIT 5`;
    const [rows] = await db.query(sql);
    console.log('rows count:', rows.length);
    console.log(rows.slice(0, 2));
  } catch (err) {
    console.error('QUERY ERROR', err);
    process.exit(1);
  }
  process.exit(0);
})();
