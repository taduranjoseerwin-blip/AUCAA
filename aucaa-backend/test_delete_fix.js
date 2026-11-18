require('dotenv').config();
const db = require('./config/db');

(async () => {
  try {
    console.log('Creating test game...');
    const [result] = await db.query(
      'INSERT INTO games (league_id, home_team_id, away_team_id, scheduled_time, status) VALUES (?, ?, ?, NOW(), ?)',
      [1, 11, 10, 'upcoming']
    );
    const gameId = result.insertId;
    console.log('Created game:', gameId);
    
    console.log('Adding player stats...');
    await db.query(
      'INSERT INTO player_stats (game_id, player_id, points) VALUES (?, ?, ?)',
      [gameId, 3, 10]
    );
    console.log('Added 1 player stat');
    
    console.log('\nAttempting delete via route logic...');
    try {
      // Simulate what the route does
      const [statRes] = await db.query('DELETE FROM player_stats WHERE game_id = ?', [gameId]);
      console.log('✓ Deleted player_stats:', statRes.affectedRows, 'rows');
      
      try {
        const [logRes] = await db.query('DELETE FROM game_logs WHERE game_id = ?', [gameId]);
        console.log('✓ Deleted game_logs:', logRes.affectedRows, 'rows');
      } catch (err) {
        if (err.code !== 'ER_NO_SUCH_TABLE') {
          throw err;
        }
        console.log('✓ game_logs table does not exist (expected)');
      }
      
      const [gameRes] = await db.query('DELETE FROM games WHERE game_id = ?', [gameId]);
      console.log('✓ Deleted games:', gameRes.affectedRows, 'rows');
      console.log('\n✅ DELETE successful!');
    } catch (delErr) {
      console.error('❌ Delete error:', delErr.code, '-', delErr.message);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
})();
