require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin' },
      process.env.JWT_SECRET || 'your-secret-key'
    );
    
    const api = axios.create({
      baseURL: 'http://localhost:5000/api/admin',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const res = await api.get('/games');
    console.log('Games response (first game):');
    console.log(JSON.stringify(res.data[0], null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
})();
