require('dotenv').config();
const db = require('../config/db');

(async () => {
  const conn = await db.getConnection();
  try {
    const leagueName = `TEMP_LEAGUE_${Date.now()}`;
    const [leagueRes] = await conn.query(
      'INSERT INTO leagues (name, season, status, format) VALUES (?, ?, ?, ?)',
      [leagueName, '2026', 'upcoming', 'elimination']
    );
    const leagueId = leagueRes.insertId;

    const [teamA] = await conn.query(
      'INSERT INTO teams (team_name, league_id, division) VALUES (?, ?, ?)',
      ['Team A', leagueId, 'Open']
    );
    const [teamB] = await conn.query(
      'INSERT INTO teams (team_name, league_id, division) VALUES (?, ?, ?)',
      ['Team B', leagueId, 'Open']
    );

    await conn.query(
      'INSERT INTO games (league_id, home_team_id, away_team_id, scheduled_time, status) VALUES (?, ?, ?, NOW(), ?)',
      [leagueId, teamA.insertId, teamB.insertId, 'upcoming']
    );

    const [teamRows] = await conn.query('SELECT team_id FROM teams WHERE league_id = ?', [leagueId]);
    const teamIds = teamRows.map(team => team.team_id);
    console.log('teamIds', teamIds);

    await conn.beginTransaction();

    try {
      if (teamIds.length) {
        await conn.query('UPDATE players SET team_id = NULL WHERE team_id IN (?)', [teamIds]);
      }

      if (teamIds.length) {
        const [gameRows] = await conn.query(
          'SELECT game_id FROM games WHERE league_id = ? OR home_team_id IN (?) OR away_team_id IN (?)',
          [leagueId, teamIds, teamIds]
        );
        const gameIds = gameRows.map(row => row.game_id);
        console.log('gameIds', gameIds);

        if (gameIds.length) {
          await conn.query('DELETE FROM player_stats WHERE game_id IN (?)', [gameIds]);
        }

        await conn.query(
          'UPDATE games SET next_game_id = NULL, winner_team_id = NULL, bracket_id = NULL, home_team_id = NULL, away_team_id = NULL WHERE league_id = ? OR home_team_id IN (?) OR away_team_id IN (?)',
          [leagueId, teamIds, teamIds]
        );
        await conn.query(
          'DELETE FROM games WHERE league_id = ? OR home_team_id IN (?) OR away_team_id IN (?)',
          [leagueId, teamIds, teamIds]
        );
      }

      await conn.query('DELETE FROM bracket_audit WHERE league_id = ?', [leagueId]);
      await conn.query('DELETE FROM brackets WHERE league_id = ?', [leagueId]);
      await conn.query('DELETE FROM teams WHERE league_id = ?', [leagueId]);
      const [result] = await conn.query('DELETE FROM leagues WHERE league_id = ?', [leagueId]);
      console.log('affectedRows', result.affectedRows);
      await conn.commit();
      console.log('DELETE_SUCCESS');
    } catch (err) {
      console.error('DELETE_ERROR', err.code, err.message);
      await conn.rollback();
      throw err;
    }
  } catch (err) {
    console.error('OUTER_ERROR', err.code, err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
});
