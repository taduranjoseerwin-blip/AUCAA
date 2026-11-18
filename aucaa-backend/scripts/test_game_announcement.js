const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 5000
});

async function testGameAnnouncement() {
  try {
    // Step 1: Login to get token
    console.log('1. Logging in...');
    const loginRes = await api.post('/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginRes.data.token;
    console.log('✓ Token obtained:', token.substring(0, 20) + '...');

    // Step 2: Create a game
    console.log('\n2. Creating a new game...');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    const gameRes = await api.post('/games', {
      league_id: 1,
      home_team_id: 1,
      away_team_id: 2,
      venue: 'Test Arena - Announcement Test',
      scheduled_time: '2026-08-20T19:00:00'
    });

    console.log('✓ Game created:', gameRes.data);

    // Step 3: Check announcements
    console.log('\n3. Fetching announcements...');
    const annRes = await api.get('/announcements');
    
    const gameAnnouncements = annRes.data.filter(a => 
      a.type === 'schedule' && a.title.includes('vs')
    );

    console.log(`✓ Found ${gameAnnouncements.length} game announcements`);
    if (gameAnnouncements.length > 0) {
      const latest = gameAnnouncements[gameAnnouncements.length - 1];
      console.log('\nLatest Game Announcement:');
      console.log('Title:', latest.title);
      console.log('Message:', latest.message);
      console.log('Type:', latest.type);
      console.log('\n✅ SUCCESS! Announcements are being created automatically!');
    } else {
      console.log('\n⚠️ No game announcements found');
    }

  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

testGameAnnouncement();
