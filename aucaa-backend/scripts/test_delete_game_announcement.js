const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 5000
});

async function testDeleteGameAnnouncement() {
  try {
    // Step 1: Login to get token
    console.log('1. Logging in...');
    const loginRes = await api.post('/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginRes.data.token;
    console.log('✓ Token obtained');

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Step 2: Create a game
    console.log('\n2. Creating a game...');
    const gameRes = await api.post('/games', {
      league_id: 1,
      home_team_id: 1,
      away_team_id: 2,
      venue: 'Delete Test Arena',
      scheduled_time: '2026-09-05T18:00:00'
    });

    const gameId = gameRes.data.game_id;
    console.log('✓ Game created with ID:', gameId);

    // Step 3: Check announcements exist
    console.log('\n3. Fetching announcements...');
    const annRes = await api.get('/announcements');
    const gameAnnouncements = annRes.data.filter(a => a.type === 'schedule' && a.message.includes('Delete Test Arena'));
    console.log(`✓ Found ${gameAnnouncements.length} game announcement(s) for Delete Test Arena`);

    if (gameAnnouncements.length === 0) {
      console.log('⚠️ No announcements found before deletion!');
      process.exit(1);
    }

    // Step 4: Delete the game
    console.log('\n4. Deleting the game...');
    await api.delete(`/admin/games/${gameId}`);
    console.log('✓ Game deleted with ID:', gameId);

    // Step 5: Check announcements are deleted
    console.log('\n5. Checking if announcements were also deleted...');
    const annRes2 = await api.get('/announcements');
    const gameAnnouncements2 = annRes2.data.filter(a => a.type === 'schedule' && a.message.includes('Delete Test Arena'));
    console.log(`✓ Found ${gameAnnouncements2.length} announcement(s) for Delete Test Arena (should be 0)`);

    if (gameAnnouncements2.length === 0) {
      console.log('\n✅ SUCCESS! Announcement was automatically deleted with the game!');
    } else {
      console.log('\n⚠️ ERROR! Announcement still exists after game deletion!');
      process.exit(1);
    }

  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

testDeleteGameAnnouncement();
