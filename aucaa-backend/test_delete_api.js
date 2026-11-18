require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    // Create admin token
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin' },
      process.env.JWT_SECRET || 'your-secret-key'
    );
    
    const api = axios.create({
      baseURL: 'http://localhost:5000/api/admin',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Test delete game 6
    console.log('Testing DELETE /api/admin/games/6...');
    try {
      const res = await api.delete('/games/6');
      console.log('✅ Success:', res.data);
    } catch (err) {
      console.error('❌ Error:', err.response?.status, err.response?.data || err.message);
    }
  } catch (e) {
    console.error('Setup error:', e.message);
  } finally {
    process.exit(0);
  }
})();
