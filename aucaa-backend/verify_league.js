require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin' },
      process.env.JWT_SECRET || 'your-secret-key'
    );
    
    const res = await axios.get('http://localhost:5000/api/admin/games', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ API Returns games with league_name:');
    if (res.data[0]) {
      console.log('Game:', {
        game_id: res.data[0].game_id,
        home: res.data[0].home_team_name,
        away: res.data[0].away_team_name,
        league: res.data[0].league_name
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
})();
